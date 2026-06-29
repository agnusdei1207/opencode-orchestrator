use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::net::{Shutdown, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::{SystemTime, UNIX_EPOCH};

use super::prompt_detect::PromptKind;
use super::terminal::{MAX_DISPLAY_LINES, tail_text};

const IDLE_AFTER_SECS: u64 = 30 * 60;
const STALE_AFTER_SECS: u64 = 2 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProcessExitStatus {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signal: Option<i32>,
}

#[derive(Debug)]
pub enum SessionWrite {
    Bytes(Vec<u8>),
    Close,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionBackend {
    Tcp,
}

impl SessionBackend {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Tcp => "tcp",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStatus {
    Open,
    Idle,
    Busy,
    Stale,
    Closing,
    Closed,
    Archived,
}

impl SessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Idle => "idle",
            Self::Busy => "busy",
            Self::Stale => "stale",
            Self::Closing => "closing",
            Self::Closed => "closed",
            Self::Archived => "archived",
        }
    }
}

#[derive(Debug)]
pub struct SessionState {
    pub id: u64,
    pub peer: SocketAddr,
    pub connected_at: u64,
    pub last_seen: u64,
    pub closing_at: Option<u64>,
    pub closed_at: Option<u64>,
    pub archived_at: Option<u64>,
    pub raw_log_path: PathBuf,
    pub write_tx: mpsc::Sender<SessionWrite>,
    pub display_lines: VecDeque<String>,
    pub display_line_base: usize,
    pub pending_line: String,
    pub pending_displayed: bool,
    pub bytes: usize,
    pub open: bool,
    pub last_sentinel: Option<String>,
    pub last_prompt: Option<PromptKind>,
    pub backend: SessionBackend,
    pub exit_status: Option<ProcessExitStatus>,
    pub revoked: Arc<AtomicBool>,
    pub redactions: Arc<Mutex<Vec<String>>>,
    close_control: Option<TcpStream>,
}

impl SessionState {
    pub fn new(
        id: u64,
        peer: SocketAddr,
        raw_log_path: PathBuf,
        write_tx: mpsc::Sender<SessionWrite>,
        revoked: Arc<AtomicBool>,
        redactions: Arc<Mutex<Vec<String>>>,
        close_control: TcpStream,
    ) -> Self {
        let now = unix_seconds_now();
        let mut session = Self {
            id,
            peer,
            connected_at: now,
            last_seen: now,
            closing_at: None,
            closed_at: None,
            archived_at: None,
            raw_log_path,
            write_tx,
            display_lines: VecDeque::new(),
            display_line_base: 0,
            pending_line: String::new(),
            pending_displayed: false,
            bytes: 0,
            open: true,
            last_sentinel: None,
            last_prompt: None,
            backend: SessionBackend::Tcp,
            exit_status: None,
            revoked,
            redactions,
            close_control: Some(close_control),
        };
        session.push_line(format!("[connected] session_{id} peer={peer} unix={now}"));
        session
    }

    pub fn status(&self) -> SessionStatus {
        if self.archived_at.is_some() {
            SessionStatus::Archived
        } else if !self.open {
            SessionStatus::Closed
        } else if self.closing_at.is_some() {
            SessionStatus::Closing
        } else if self.last_sentinel.is_some() {
            SessionStatus::Busy
        } else if unix_seconds_now().saturating_sub(self.last_seen) >= STALE_AFTER_SECS {
            SessionStatus::Stale
        } else if unix_seconds_now().saturating_sub(self.last_seen) >= IDLE_AFTER_SECS {
            SessionStatus::Idle
        } else {
            SessionStatus::Open
        }
    }

    pub fn append_output(&mut self, text: &str) {
        let normalized = redact_sensitive_text(text, &self.redactions).replace("\r\n", "\n");
        self.last_seen = unix_seconds_now();
        for ch in normalized.chars() {
            match ch {
                '\n' => {
                    let line = std::mem::take(&mut self.pending_line);
                    if self.pending_displayed {
                        if let Some(last) = self.display_lines.back_mut() {
                            *last = line;
                        }
                    } else {
                        self.push_line(line);
                    }
                    self.pending_displayed = false;
                }
                '\r' => {
                    if self.pending_displayed {
                        self.display_lines.pop_back();
                    }
                    self.pending_line.clear();
                    self.pending_displayed = false;
                }
                _ => self.pending_line.push(ch),
            }
        }
        if !self.pending_line.is_empty() {
            if self.pending_displayed {
                if let Some(last) = self.display_lines.back_mut() {
                    *last = self.pending_line.clone();
                }
            } else {
                self.push_line(self.pending_line.clone());
                self.pending_displayed = true;
            }
        }
    }

    pub fn push_line(&mut self, line: String) {
        self.display_lines.push_back(line);
        while self.display_lines.len() > MAX_DISPLAY_LINES {
            self.display_lines.pop_front();
            self.display_line_base = self.display_line_base.saturating_add(1);
        }
    }

    pub fn output_since(&self, cursor: usize, limit_bytes: usize) -> String {
        let start = self.relative_line_index(cursor);
        let output = self
            .display_lines
            .iter()
            .skip(start)
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        tail_text(&output, limit_bytes)
    }

    pub fn output_since_without_marker(
        &self,
        cursor: usize,
        limit_bytes: usize,
        marker: &str,
    ) -> String {
        self.output_since(cursor, limit_bytes)
            .lines()
            .filter(|line| !line.contains(marker))
            .collect::<Vec<_>>()
            .join("\n")
    }

    pub fn next_output_cursor(&self) -> usize {
        self.display_line_base
            .saturating_add(self.display_lines.len())
    }

    pub fn command_start_cursor(&self) -> usize {
        self.next_output_cursor()
            .saturating_sub(usize::from(self.pending_displayed))
    }

    pub fn is_writable(&self) -> bool {
        self.open && self.closing_at.is_none() && self.archived_at.is_none()
    }

    pub fn send_bytes(&self, bytes: Vec<u8>) -> Result<(), mpsc::SendError<SessionWrite>> {
        self.write_tx.send(SessionWrite::Bytes(bytes))
    }

    pub fn request_close(&mut self, reason: &str) {
        self.mark_closing();
        let _ = self.write_tx.send(SessionWrite::Close);
        self.push_line(format!("[closing] close requested: {reason}"));
    }

    pub fn force_revoke(&mut self, reason: &str) {
        self.revoked.store(true, Ordering::Release);
        self.mark_closing();
        if let Some(stream) = &self.close_control {
            let _ = stream.shutdown(Shutdown::Both);
        }
        let _ = self.write_tx.send(SessionWrite::Close);
        self.close_control = None;
        self.push_line(format!("[revoking] forced close: {reason}"));
    }

    pub fn mark_closing(&mut self) {
        if self.closing_at.is_none() {
            self.closing_at = Some(unix_seconds_now());
        }
    }

    pub fn mark_closed(&mut self) {
        self.open = false;
        if self.closed_at.is_none() {
            self.closed_at = Some(unix_seconds_now());
        }
        self.close_control = None;
    }

    pub fn fd_owned(&self) -> bool {
        self.close_control.is_some()
    }

    pub fn add_redaction(&self, value: &str) {
        if value.is_empty() {
            return;
        }
        let mut redactions = self
            .redactions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !redactions.iter().any(|existing| existing == value) {
            redactions.push(value.to_string());
        }
    }

    fn relative_line_index(&self, cursor: usize) -> usize {
        cursor
            .saturating_sub(self.display_line_base)
            .min(self.display_lines.len())
    }
}

pub fn unix_seconds_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

pub fn redact_sensitive_text(text: &str, redactions: &Arc<Mutex<Vec<String>>>) -> String {
    let redactions = redactions
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if redactions.is_empty() {
        return text.to_string();
    }
    let mut redacted = text.to_string();
    for secret in redactions.iter().filter(|secret| !secret.is_empty()) {
        redacted = redacted.replace(secret, "[REDACTED_SECRET]");
    }
    redacted
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> SessionState {
        let (tx, _rx) = mpsc::channel();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let client = TcpStream::connect(addr).unwrap();
        let (server, _) = listener.accept().unwrap();
        drop(client);
        SessionState::new(
            1,
            addr,
            PathBuf::from("session.raw.log"),
            tx,
            Arc::new(AtomicBool::new(false)),
            Arc::new(Mutex::new(Vec::new())),
            server,
        )
    }

    #[test]
    fn lifecycle_transitions_release_close_handle() {
        let mut session = fixture();
        assert!(session.fd_owned());
        assert_eq!(session.status(), SessionStatus::Open);
        session.mark_closing();
        assert_eq!(session.status(), SessionStatus::Closing);
        session.mark_closed();
        assert_eq!(session.status(), SessionStatus::Closed);
        assert!(!session.fd_owned());
    }

    #[test]
    fn output_cursor_filters_marker() {
        let mut session = fixture();
        let cursor = session.next_output_cursor();
        session.append_output("one\n__MARKER__\ntwo\n");
        assert_eq!(
            session.output_since_without_marker(cursor, 4096, "__MARKER__"),
            "one\ntwo"
        );
    }

    #[test]
    fn redaction_applies_to_output() {
        let mut session = fixture();
        session.add_redaction("plain-secret");
        session.append_output("token=plain-secret\n");
        assert!(session.output_since(0, 4096).contains("[REDACTED_SECRET]"));
        assert!(!session.output_since(0, 4096).contains("plain-secret"));
    }
}
