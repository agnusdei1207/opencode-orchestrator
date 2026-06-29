use anyhow::{Context, Result, bail};
use std::collections::BTreeMap;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use super::control::{
    CONTROL_PROTOCOL_VERSION, ControlOp, ControlRequest, ControlResponse, ControlSession,
    LifecycleSession,
};
use super::control_socket::ControlEnvelope;
use super::fd_budget::FdAccounting;
use super::pending::PendingRun;
use super::prompt_detect::detect_interactive_prompt;
use super::session::SessionState;
use super::terminal::{
    DEFAULT_LIMIT_BYTES, PTY_HELPER, as_line, sentinel_token, wrap_with_sentinel,
};

const DEFAULT_RUN_TIMEOUT_MS: u64 = 30_000;

#[derive(Debug)]
pub enum ListenerEvent {
    Connected(SessionState),
    Output { id: u64, bytes: usize, text: String },
    Disconnected { id: u64, reason: String },
    Warning(String),
    Error(String),
}

#[derive(Debug, PartialEq, Eq)]
pub enum CommandOutcome {
    Continue(String),
    Quit,
}

pub struct SessionRegistry {
    sessions: BTreeMap<u64, SessionState>,
    active_id: Option<u64>,
    pending_runs: Vec<PendingRun>,
    accounting: FdAccounting,
}

impl SessionRegistry {
    pub fn new(accounting: FdAccounting) -> Self {
        Self {
            sessions: BTreeMap::new(),
            active_id: None,
            pending_runs: Vec::new(),
            accounting,
        }
    }

    pub fn apply_event(&mut self, event: ListenerEvent) -> String {
        match event {
            ListenerEvent::Connected(session) => {
                let id = session.id;
                let peer = session.peer;
                self.active_id.get_or_insert(id);
                self.sessions.insert(id, session);
                format!("[session_{id}] connected from {peer}")
            }
            ListenerEvent::Output { id, bytes, text } => {
                let mut completed = Vec::new();
                if let Some(session) = self.sessions.get_mut(&id) {
                    session.bytes = session.bytes.saturating_add(bytes);
                    session.append_output(&text);
                    session.last_prompt =
                        detect_interactive_prompt(&session.output_since(0, DEFAULT_LIMIT_BYTES));
                    for (index, pending) in self.pending_runs.iter().enumerate() {
                        if pending.matches_marker(id, &text) {
                            completed.push(index);
                        }
                    }
                }
                for index in completed.into_iter().rev() {
                    let pending = self.pending_runs.remove(index);
                    let output = self
                        .sessions
                        .get(&pending.session_id)
                        .map(|session| {
                            session.output_since_without_marker(
                                pending.start_cursor,
                                pending.limit_bytes,
                                &pending.marker,
                            )
                        })
                        .unwrap_or_default();
                    if let Some(session) = self.sessions.get_mut(&pending.session_id) {
                        session.last_sentinel = None;
                    }
                    pending.send_ok(output, self.control_sessions());
                }
                format!("[session_{id}] {text}")
            }
            ListenerEvent::Disconnected { id, reason } => {
                if let Some(session) = self.sessions.get_mut(&id) {
                    session.mark_closed();
                    session.push_line(format!("[closed] {reason}"));
                }
                if self.active_id == Some(id) {
                    self.active_id = None;
                }
                self.fail_pending_for_closed_session(id);
                format!("[session_{id}] closed: {reason}")
            }
            ListenerEvent::Warning(message) => format!("[warning] {message}"),
            ListenerEvent::Error(message) => format!("[error] {message}"),
        }
    }

    pub fn execute_operator_command(&mut self, command: &str) -> Result<CommandOutcome> {
        if command.trim().is_empty() {
            return Ok(CommandOutcome::Continue(String::new()));
        }
        let (head, tail) = split_head(command);
        match head {
            "help" => Ok(CommandOutcome::Continue(operator_help())),
            "sessions" | "list" => Ok(CommandOutcome::Continue(self.format_sessions())),
            "fdstat" => Ok(CommandOutcome::Continue(format_fdstat(
                self.accounting.report(),
            ))),
            "lifecycle" => Ok(CommandOutcome::Continue(self.format_lifecycle())),
            "use" => {
                let id = parse_required_id(tail, "use")?;
                self.require_session(id)?;
                self.active_id = Some(id);
                Ok(CommandOutcome::Continue(format!("active session: {id}")))
            }
            "detach" => {
                self.active_id = None;
                Ok(CommandOutcome::Continue(
                    "active session cleared".to_string(),
                ))
            }
            "tail" => {
                let id = if tail.is_empty() {
                    self.active_id.context("no active session")?
                } else {
                    parse_required_id(tail, "tail")?
                };
                let session = self.require_session(id)?;
                Ok(CommandOutcome::Continue(
                    session.output_since(0, DEFAULT_LIMIT_BYTES),
                ))
            }
            "send" => {
                let id = self.active_id.context("no active session")?;
                self.send_line(id, tail, false)?;
                Ok(CommandOutcome::Continue(format!(
                    "sent line to session_{id}"
                )))
            }
            "raw" => {
                let id = self.active_id.context("no active session")?;
                self.send_raw(id, tail.as_bytes().to_vec(), false)?;
                Ok(CommandOutcome::Continue(format!(
                    "sent raw bytes to session_{id}"
                )))
            }
            "run" => {
                let id = self.active_id.context("no active session")?;
                let marker = self.start_run_without_reply(id, tail)?;
                Ok(CommandOutcome::Continue(format!(
                    "sent run to session_{id}; marker={marker}"
                )))
            }
            "pty" => {
                let id = self.active_id.context("no active session")?;
                self.send_raw(id, PTY_HELPER.as_bytes().to_vec(), false)?;
                Ok(CommandOutcome::Continue(format!(
                    "sent PTY helper to session_{id}"
                )))
            }
            "close" => {
                let id = if tail.is_empty() {
                    self.active_id.context("no active session")?
                } else {
                    parse_required_id(tail, "close")?
                };
                self.close_session(id, "operator close")?;
                Ok(CommandOutcome::Continue(format!(
                    "close requested for session_{id}"
                )))
            }
            "revoke" => {
                let id = if tail.is_empty() {
                    self.active_id.context("no active session")?
                } else {
                    parse_required_id(tail, "revoke")?
                };
                self.revoke_session(id, "operator revoke")?;
                Ok(CommandOutcome::Continue(format!("revoked session_{id}")))
            }
            "quit" | "exit" => Ok(CommandOutcome::Quit),
            _ => {
                let id = self.active_id.context("no active session")?;
                self.send_line(id, command, false)?;
                Ok(CommandOutcome::Continue(format!(
                    "sent line to session_{id}"
                )))
            }
        }
    }

    pub fn handle_control_envelope(&mut self, envelope: ControlEnvelope) {
        let response = self.handle_control_request(&envelope.request, envelope.reply_tx.clone());
        if let Some(response) = response {
            let _ = envelope.reply_tx.send(response);
        }
    }

    pub fn expire_pending_runs(&mut self) -> usize {
        let now = Instant::now();
        let mut expired = Vec::new();
        for (index, pending) in self.pending_runs.iter().enumerate() {
            if pending.is_expired(now) {
                expired.push(index);
            }
        }
        let count = expired.len();
        for index in expired.into_iter().rev() {
            let pending = self.pending_runs.remove(index);
            let output = self
                .sessions
                .get(&pending.session_id)
                .map(|session| {
                    session.output_since_without_marker(
                        pending.start_cursor,
                        pending.limit_bytes,
                        &pending.marker,
                    )
                })
                .unwrap_or_default();
            pending.send_timeout(output, self.control_sessions());
        }
        count
    }

    fn handle_control_request(
        &mut self,
        request: &ControlRequest,
        reply_tx: mpsc::Sender<ControlResponse>,
    ) -> Option<ControlResponse> {
        if request.version != CONTROL_PROTOCOL_VERSION {
            return Some(ControlResponse::error(
                request,
                format!("unsupported control protocol version {}", request.version),
            ));
        }
        match request.op {
            ControlOp::Help => Some(ControlResponse::ok(request, "help is available via CLI")),
            ControlOp::Health => {
                let mut response = ControlResponse::ok(request, "healthy");
                response.fdstat = Some(self.accounting.report());
                Some(response)
            }
            ControlOp::List => {
                let mut response = ControlResponse::ok(request, "sessions");
                response.sessions = self.control_sessions();
                Some(response)
            }
            ControlOp::Info => Some(match self.selected_session(request) {
                Ok(id) => {
                    let mut response = ControlResponse::ok(request, format!("session_{id}"));
                    response.sessions = self
                        .sessions
                        .get(&id)
                        .map(|session| vec![self.control_session(session)])
                        .unwrap_or_default();
                    response
                }
                Err(error) => ControlResponse::error(request, error.to_string()),
            }),
            ControlOp::Tail => Some(match self.selected_session(request) {
                Ok(id) => {
                    let session = self.sessions.get(&id).expect("selected session exists");
                    let cursor = request.since_cursor.unwrap_or(0);
                    let limit = request.limit_bytes.unwrap_or(DEFAULT_LIMIT_BYTES);
                    let mut response = ControlResponse::ok(request, format!("tail session_{id}"));
                    response.output = Some(session.output_since(cursor, limit));
                    response.next_cursor = Some(session.next_output_cursor());
                    response.sessions = vec![self.control_session(session)];
                    response
                }
                Err(error) => ControlResponse::error(request, error.to_string()),
            }),
            ControlOp::Fdstat => {
                let mut response = ControlResponse::ok(request, "fdstat");
                response.fdstat = Some(self.accounting.report());
                Some(response)
            }
            ControlOp::Lifecycle => {
                let mut response = ControlResponse::ok(request, "lifecycle");
                response.lifecycle = self.lifecycle_sessions();
                Some(response)
            }
            ControlOp::Send | ControlOp::Raw => Some(match self.handle_send_request(request) {
                Ok(message) => ControlResponse::ok(request, message),
                Err(error) => ControlResponse::error(request, error.to_string()),
            }),
            ControlOp::Close => Some(
                match self.selected_session(request).and_then(|id| {
                    self.close_session(id, request.reason.as_deref().unwrap_or("control close"))
                        .map(|_| id)
                }) {
                    Ok(id) => {
                        ControlResponse::ok(request, format!("close requested for session_{id}"))
                    }
                    Err(error) => ControlResponse::error(request, error.to_string()),
                },
            ),
            ControlOp::Revoke => Some(
                match self.selected_session(request).and_then(|id| {
                    self.revoke_session(id, request.reason.as_deref().unwrap_or("control revoke"))
                        .map(|_| id)
                }) {
                    Ok(id) => ControlResponse::ok(request, format!("revoked session_{id}")),
                    Err(error) => ControlResponse::error(request, error.to_string()),
                },
            ),
            ControlOp::Run => match self.handle_run_request(request.clone(), reply_tx) {
                Ok(()) => None,
                Err(error) => Some(ControlResponse::error(request, error.to_string())),
            },
        }
    }

    fn handle_send_request(&mut self, request: &ControlRequest) -> Result<String> {
        let id = self.selected_session(request)?;
        let text = request.text.as_deref().context("send/raw requires text")?;
        if request.sensitive {
            self.require_session(id)?.add_redaction(text);
        }
        match request.op {
            ControlOp::Send => self.send_line(id, text, request.sensitive)?,
            ControlOp::Raw => self.send_raw(id, text.as_bytes().to_vec(), request.sensitive)?,
            _ => unreachable!("send handler only receives send/raw"),
        }
        Ok(format!("sent to session_{id}"))
    }

    fn handle_run_request(
        &mut self,
        request: ControlRequest,
        reply_tx: mpsc::Sender<ControlResponse>,
    ) -> Result<()> {
        let id = self.selected_session(&request)?;
        let command = request.text.as_deref().context("run requires text")?;
        let marker = sentinel_token();
        let timeout = Duration::from_millis(request.timeout_ms.unwrap_or(DEFAULT_RUN_TIMEOUT_MS));
        let limit = request.limit_bytes.unwrap_or(DEFAULT_LIMIT_BYTES);
        let start_cursor = self.require_session(id)?.command_start_cursor();
        let wrapped = wrap_with_sentinel(command, &marker);
        self.send_raw(id, wrapped.into_bytes(), false)?;
        self.require_session_mut(id)?.last_sentinel = Some(marker.clone());
        self.pending_runs.push(PendingRun::new(
            request,
            reply_tx,
            id,
            marker,
            timeout,
            start_cursor,
            limit,
        ));
        Ok(())
    }

    fn start_run_without_reply(&mut self, id: u64, command: &str) -> Result<String> {
        if command.trim().is_empty() {
            bail!("run requires a command");
        }
        let marker = sentinel_token();
        let wrapped = wrap_with_sentinel(command, &marker);
        self.send_raw(id, wrapped.into_bytes(), false)?;
        self.require_session_mut(id)?.last_sentinel = Some(marker.clone());
        Ok(marker)
    }

    fn selected_session(&self, request: &ControlRequest) -> Result<u64> {
        let selector = request
            .selector
            .as_deref()
            .context("session selector is required")?;
        let id = selector
            .strip_prefix("session_")
            .unwrap_or(selector)
            .parse::<u64>()
            .with_context(|| format!("invalid session selector: {selector}"))?;
        self.require_session(id)?;
        Ok(id)
    }

    fn require_session(&self, id: u64) -> Result<&SessionState> {
        self.sessions
            .get(&id)
            .with_context(|| format!("session {id} does not exist"))
    }

    fn require_session_mut(&mut self, id: u64) -> Result<&mut SessionState> {
        self.sessions
            .get_mut(&id)
            .with_context(|| format!("session {id} does not exist"))
    }

    fn send_line(&mut self, id: u64, text: &str, sensitive: bool) -> Result<()> {
        let line = as_line(text);
        self.send_raw(id, line.into_bytes(), sensitive)
    }

    fn send_raw(&mut self, id: u64, bytes: Vec<u8>, sensitive: bool) -> Result<()> {
        let session = self.require_session_mut(id)?;
        if !session.is_writable() {
            bail!("session {id} is not writable");
        }
        if sensitive && let Ok(text) = String::from_utf8(bytes.clone()) {
            session.add_redaction(&text);
        }
        session.send_bytes(bytes)?;
        Ok(())
    }

    fn close_session(&mut self, id: u64, reason: &str) -> Result<()> {
        let session = self.require_session_mut(id)?;
        if !session.open {
            bail!("session {id} is already closed");
        }
        session.request_close(reason);
        Ok(())
    }

    fn revoke_session(&mut self, id: u64, reason: &str) -> Result<()> {
        let session = self.require_session_mut(id)?;
        if !session.open {
            bail!("session {id} is already closed");
        }
        session.force_revoke(reason);
        Ok(())
    }

    fn fail_pending_for_closed_session(&mut self, id: u64) {
        let mut closed = Vec::new();
        for (index, pending) in self.pending_runs.iter().enumerate() {
            if pending.session_id == id {
                closed.push(index);
            }
        }
        for index in closed.into_iter().rev() {
            let pending = self.pending_runs.remove(index);
            let output = self
                .sessions
                .get(&pending.session_id)
                .map(|session| {
                    session.output_since_without_marker(
                        pending.start_cursor,
                        pending.limit_bytes,
                        &pending.marker,
                    )
                })
                .unwrap_or_default();
            pending.send_closed(output, self.control_sessions());
        }
    }

    fn control_sessions(&self) -> Vec<ControlSession> {
        self.sessions
            .values()
            .map(|session| self.control_session(session))
            .collect()
    }

    fn control_session(&self, session: &SessionState) -> ControlSession {
        ControlSession {
            id: session.id,
            status: session.status().as_str().to_string(),
            peer: session.peer.to_string(),
            bytes: session.bytes,
            raw_log_path: session.raw_log_path.display().to_string(),
            active: self.active_id == Some(session.id),
            next_cursor: session.next_output_cursor(),
            last_prompt: session.last_prompt,
            exit_status: session.exit_status.clone(),
        }
    }

    fn lifecycle_sessions(&self) -> Vec<LifecycleSession> {
        self.sessions
            .values()
            .map(|session| LifecycleSession {
                id: session.id,
                status: session.status().as_str().to_string(),
                active: self.active_id == Some(session.id),
                revoked: session.revoked.load(std::sync::atomic::Ordering::Acquire),
                fd_owned: session.fd_owned(),
                backend: session.backend.as_str().to_string(),
                close_requested: session.closing_at.is_some(),
                connected_at: session.connected_at,
                last_seen: session.last_seen,
                closing_at: session.closing_at,
                closed_at: session.closed_at,
                archived_at: session.archived_at,
                bytes: session.bytes,
                exit_status: session.exit_status.clone(),
                last_sentinel: session.last_sentinel.clone(),
                last_prompt: session.last_prompt,
            })
            .collect()
    }

    fn format_sessions(&self) -> String {
        if self.sessions.is_empty() {
            return "sessions: none".to_string();
        }
        self.control_sessions()
            .into_iter()
            .map(|session| {
                let active = if session.active { "*" } else { " " };
                format!(
                    "{active} session_{} {} peer={} bytes={} cursor={} log={}",
                    session.id,
                    session.status,
                    session.peer,
                    session.bytes,
                    session.next_cursor,
                    session.raw_log_path
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn format_lifecycle(&self) -> String {
        if self.sessions.is_empty() {
            return "lifecycle: none".to_string();
        }
        self.lifecycle_sessions()
            .into_iter()
            .map(|session| {
                format!(
                    "session_{} {} backend={} active={} revoked={} fd_owned={} close_requested={} bytes={}",
                    session.id,
                    session.status,
                    session.backend,
                    session.active,
                    session.revoked,
                    session.fd_owned,
                    session.close_requested,
                    session.bytes
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

fn split_head(input: &str) -> (&str, &str) {
    input
        .split_once(char::is_whitespace)
        .map(|(head, tail)| (head, tail.trim()))
        .unwrap_or((input, ""))
}

fn parse_required_id(value: &str, command: &str) -> Result<u64> {
    if value.is_empty() {
        bail!("{command} requires a session id");
    }
    Ok(value
        .strip_prefix("session_")
        .unwrap_or(value)
        .parse::<u64>()?)
}

fn operator_help() -> String {
    [
        "TUI commands:",
        "  sessions | list",
        "  use <id>",
        "  detach",
        "  send <text>",
        "  raw <text>",
        "  run <cmd>",
        "  tail [id]",
        "  fdstat",
        "  lifecycle",
        "  pty",
        "  close [id]",
        "  revoke [id]",
        "  quit",
    ]
    .join("\n")
}

fn format_fdstat(report: super::fd_budget::FdStatReport) -> String {
    format!(
        "fd soft_limit={} headroom={} fds_per_session={} max_sessions={} active={} est_fds={} pressure={}%",
        report.soft_limit,
        report.headroom,
        report.fds_per_session,
        report.max_sessions,
        report.active_sessions,
        report.est_fds_in_use,
        report.pressure_pct
    )
}

#[cfg(test)]
mod tests {
    use super::super::fd_budget::{ActiveSessionCounter, FdBudget};
    use super::*;

    #[test]
    fn empty_operator_command_is_noop() {
        let accounting = FdAccounting::new(FdBudget::new(1024, 64, 5), ActiveSessionCounter::new());
        let mut registry = SessionRegistry::new(accounting);
        assert_eq!(
            registry.execute_operator_command("").unwrap(),
            CommandOutcome::Continue(String::new())
        );
    }
}
