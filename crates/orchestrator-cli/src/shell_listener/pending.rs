use std::sync::mpsc;
use std::time::{Duration, Instant};

use super::control::{ControlRequest, ControlResponse, ControlSession};

#[derive(Debug)]
pub struct PendingRun {
    pub request: ControlRequest,
    pub reply_tx: mpsc::Sender<ControlResponse>,
    pub session_id: u64,
    pub marker: String,
    pub started_at: Instant,
    pub deadline: Instant,
    pub start_cursor: usize,
    pub limit_bytes: usize,
}

impl PendingRun {
    pub fn new(
        request: ControlRequest,
        reply_tx: mpsc::Sender<ControlResponse>,
        session_id: u64,
        marker: String,
        timeout: Duration,
        start_cursor: usize,
        limit_bytes: usize,
    ) -> Self {
        let started_at = Instant::now();
        Self {
            request,
            reply_tx,
            session_id,
            marker,
            started_at,
            deadline: started_at + timeout,
            start_cursor,
            limit_bytes,
        }
    }

    pub fn matches_marker(&self, session_id: u64, text: &str) -> bool {
        self.session_id == session_id && text.contains(&self.marker)
    }

    pub fn is_expired(&self, now: Instant) -> bool {
        now >= self.deadline
    }

    pub fn send_ok(self, output: String, sessions: Vec<ControlSession>) {
        let elapsed = Instant::now()
            .saturating_duration_since(self.started_at)
            .as_millis();
        let mut response =
            ControlResponse::ok(&self.request, format!("run completed in {elapsed}ms"));
        response.output = Some(output);
        response.marker = Some(self.marker);
        response.timed_out = Some(false);
        response.sessions = sessions;
        let _ = self.reply_tx.send(response);
    }

    pub fn send_timeout(self, output: String, sessions: Vec<ControlSession>) {
        let mut response = ControlResponse::error(&self.request, "run timed out");
        response.output = Some(output);
        response.marker = Some(self.marker);
        response.timed_out = Some(true);
        response.sessions = sessions;
        let _ = self.reply_tx.send(response);
    }

    pub fn send_closed(self, output: String, sessions: Vec<ControlSession>) {
        let mut response = ControlResponse::error(&self.request, "session closed before marker");
        response.output = Some(output);
        response.marker = Some(self.marker);
        response.timed_out = Some(false);
        response.sessions = sessions;
        let _ = self.reply_tx.send(response);
    }
}

#[cfg(test)]
mod tests {
    use super::super::control::ControlOp;
    use super::*;

    #[test]
    fn pending_run_tracks_marker_and_expiration() {
        let (tx, _rx) = mpsc::channel();
        let pending = PendingRun::new(
            ControlRequest::new(ControlOp::Run),
            tx,
            7,
            "__DONE__".to_string(),
            Duration::from_millis(1),
            0,
            4096,
        );
        assert!(pending.matches_marker(7, "x __DONE__ y"));
        assert!(!pending.matches_marker(8, "x __DONE__ y"));
        assert!(pending.is_expired(Instant::now() + Duration::from_secs(1)));
    }
}
