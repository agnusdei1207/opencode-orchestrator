use serde::{Deserialize, Serialize};
use std::time::Duration;

use super::fd_budget::FdStatReport;
use super::prompt_detect::PromptKind;
use super::session::ProcessExitStatus;

pub const CONTROL_PROTOCOL_VERSION: u64 = 1;
const CONTROL_RESPONSE_GRACE_MS: u64 = 2_000;
const DEFAULT_CONTROL_RESPONSE_TIMEOUT_MS: u64 = 30_000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ControlOp {
    Help,
    Health,
    List,
    Info,
    Tail,
    Send,
    Raw,
    Run,
    Close,
    Revoke,
    Fdstat,
    Lifecycle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlRequest {
    #[serde(default = "control_protocol_version")]
    pub version: u64,
    #[serde(default)]
    pub request_id: Option<String>,
    pub op: ControlOp,
    #[serde(default)]
    pub selector: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub limit_bytes: Option<usize>,
    #[serde(default)]
    pub since_cursor: Option<usize>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub sensitive: bool,
}

impl ControlRequest {
    pub fn new(op: ControlOp) -> Self {
        Self {
            version: CONTROL_PROTOCOL_VERSION,
            request_id: None,
            op,
            selector: None,
            text: None,
            timeout_ms: None,
            limit_bytes: None,
            since_cursor: None,
            reason: None,
            sensitive: false,
        }
    }

    pub fn selector(mut self, selector: String) -> Self {
        self.selector = Some(selector);
        self
    }

    pub fn text(mut self, text: String) -> Self {
        self.text = Some(text);
        self
    }

    pub fn response_timeout(&self) -> Duration {
        let timeout_ms = self
            .timeout_ms
            .unwrap_or(DEFAULT_CONTROL_RESPONSE_TIMEOUT_MS)
            .saturating_add(CONTROL_RESPONSE_GRACE_MS);
        Duration::from_millis(timeout_ms)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlResponse {
    pub version: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sessions: Vec<ControlSession>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lifecycle: Vec<LifecycleSession>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timed_out: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_status: Option<ProcessExitStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fdstat: Option<FdStatReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlSession {
    pub id: u64,
    pub status: String,
    pub peer: String,
    pub bytes: usize,
    pub raw_log_path: String,
    pub active: bool,
    pub next_cursor: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_prompt: Option<PromptKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_status: Option<ProcessExitStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LifecycleSession {
    pub id: u64,
    pub status: String,
    pub active: bool,
    pub revoked: bool,
    pub fd_owned: bool,
    pub backend: String,
    pub close_requested: bool,
    pub connected_at: u64,
    pub last_seen: u64,
    pub closing_at: Option<u64>,
    pub closed_at: Option<u64>,
    pub archived_at: Option<u64>,
    pub bytes: usize,
    pub exit_status: Option<ProcessExitStatus>,
    pub last_sentinel: Option<String>,
    pub last_prompt: Option<PromptKind>,
}

impl ControlResponse {
    pub fn ok(request: &ControlRequest, message: impl Into<String>) -> Self {
        Self {
            version: CONTROL_PROTOCOL_VERSION,
            request_id: request.request_id.clone(),
            ok: true,
            error: None,
            message: Some(message.into()),
            sessions: Vec::new(),
            lifecycle: Vec::new(),
            output: None,
            marker: None,
            timed_out: None,
            next_cursor: None,
            exit_status: None,
            fdstat: None,
        }
    }

    pub fn error(request: &ControlRequest, error: impl Into<String>) -> Self {
        Self {
            version: CONTROL_PROTOCOL_VERSION,
            request_id: request.request_id.clone(),
            ok: false,
            error: Some(error.into()),
            message: None,
            sessions: Vec::new(),
            lifecycle: Vec::new(),
            output: None,
            marker: None,
            timed_out: None,
            next_cursor: None,
            exit_status: None,
            fdstat: None,
        }
    }
}

pub fn control_protocol_version() -> u64 {
    CONTROL_PROTOCOL_VERSION
}

pub fn print_control_response(response: &ControlResponse) {
    if let Some(message) = &response.message {
        println!("{message}");
    }
    if let Some(error) = &response.error {
        eprintln!("{error}");
    }
    for session in &response.sessions {
        println!(
            "session_{} {} peer={} bytes={} cursor={} log={}",
            session.id,
            session.status,
            session.peer,
            session.bytes,
            session.next_cursor,
            session.raw_log_path
        );
    }
    for session in &response.lifecycle {
        let fd = if session.fd_owned {
            "fd=owned"
        } else {
            "fd=released"
        };
        println!(
            "session_{} {} backend={} active={} revoked={} {} bytes={}",
            session.id,
            session.status,
            session.backend,
            session.active,
            session.revoked,
            fd,
            session.bytes
        );
    }
    if let Some(fdstat) = &response.fdstat {
        println!(
            "fd soft_limit={} max_sessions={} active={} est_fds={} pressure={}%",
            fdstat.soft_limit,
            fdstat.max_sessions,
            fdstat.active_sessions,
            fdstat.est_fds_in_use,
            fdstat.pressure_pct
        );
    }
    if let Some(output) = &response.output {
        println!("{output}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_timeout_includes_grace() {
        let mut request = ControlRequest::new(ControlOp::Run);
        request.timeout_ms = Some(100);
        assert_eq!(request.response_timeout(), Duration::from_millis(2_100));
    }
}
