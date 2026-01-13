//! Agent communication protocol
//!
//! Standardized message format for efficient inter-agent communication.
//! Designed for minimal token usage while maintaining clarity.

use serde::{Deserialize, Serialize};

/// Message type for inter-agent communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentMessage {
    /// Request from Orchestrator to an agent
    Request(TaskRequest),
    /// Response from an agent
    Response(TaskResponse),
    /// Error report
    Error(ErrorReport),
    /// Status update
    Status(StatusUpdate),
}

/// Task request from Orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRequest {
    /// Unique task ID
    pub task_id: String,
    /// Target agent
    pub to: String,
    /// Brief action description
    pub action: String,
    /// Target file (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    /// Environment summary
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<String>,
    /// FIXED zones (brief list)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fixed: Vec<String>,
    /// Context from previous task
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    /// Extra instructions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// Task response from an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    /// Task ID being responded to
    pub task_id: String,
    /// From agent
    pub from: String,
    /// Status: ok, fail, need_info
    pub status: ResponseStatus,
    /// Brief summary of what was done
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// Output/result (code, plan, review result)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    /// Discovered FIXED zones (from Searcher)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fixed_zones: Vec<String>,
    /// Errors found (from Reviewer)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<String>,
    /// Next suggested action
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next: Option<String>,
}

/// Response status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStatus {
    /// Task completed successfully
    Ok,
    /// Task failed
    Fail,
    /// Need more information
    NeedInfo,
    /// Partial completion
    Partial,
}

/// Error report for Fixer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorReport {
    /// Error ID
    pub id: String,
    /// Error category
    pub category: String,
    /// File path
    pub file: String,
    /// Line number (if known)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    /// Brief issue description
    pub issue: String,
    /// What was found
    #[serde(skip_serializing_if = "Option::is_none")]
    pub found: Option<String>,
    /// What was expected
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
}

/// Status update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdate {
    /// From agent
    pub from: String,
    /// Current phase
    pub phase: String,
    /// Progress (0-100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<u8>,
    /// Brief message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl TaskRequest {
    /// Create a new task request
    pub fn new(task_id: impl Into<String>, to: impl Into<String>, action: impl Into<String>) -> Self {
        Self {
            task_id: task_id.into(),
            to: to.into(),
            action: action.into(),
            file: None,
            env: None,
            fixed: Vec::new(),
            context: None,
            note: None,
        }
    }

    pub fn with_file(mut self, file: impl Into<String>) -> Self {
        self.file = Some(file.into());
        self
    }

    pub fn with_env(mut self, env: impl Into<String>) -> Self {
        self.env = Some(env.into());
        self
    }

    pub fn with_fixed(mut self, fixed: Vec<String>) -> Self {
        self.fixed = fixed;
        self
    }

    pub fn with_context(mut self, context: impl Into<String>) -> Self {
        self.context = Some(context.into());
        self
    }

    pub fn with_note(mut self, note: impl Into<String>) -> Self {
        self.note = Some(note.into());
        self
    }
}

impl TaskResponse {
    /// Create success response
    pub fn ok(task_id: impl Into<String>, from: impl Into<String>) -> Self {
        Self {
            task_id: task_id.into(),
            from: from.into(),
            status: ResponseStatus::Ok,
            summary: None,
            output: None,
            fixed_zones: Vec::new(),
            errors: Vec::new(),
            next: None,
        }
    }

    /// Create failure response
    pub fn fail(task_id: impl Into<String>, from: impl Into<String>) -> Self {
        Self {
            task_id: task_id.into(),
            from: from.into(),
            status: ResponseStatus::Fail,
            summary: None,
            output: None,
            fixed_zones: Vec::new(),
            errors: Vec::new(),
            next: None,
        }
    }

    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = Some(summary.into());
        self
    }

    pub fn with_output(mut self, output: impl Into<String>) -> Self {
        self.output = Some(output.into());
        self
    }

    pub fn with_errors(mut self, errors: Vec<String>) -> Self {
        self.errors = errors;
        self.status = ResponseStatus::Fail;
        self
    }

    pub fn with_fixed_zones(mut self, zones: Vec<String>) -> Self {
        self.fixed_zones = zones;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_serialization() {
        let req = TaskRequest::new("TASK-001", "coder", "Implement login function")
            .with_file("src/auth.rs")
            .with_env("macOS, cargo")
            .with_fixed(vec!["Cargo.toml".into()]);

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("TASK-001"));
        assert!(json.contains("coder"));
    }

    #[test]
    fn test_response_serialization() {
        let resp = TaskResponse::ok("TASK-001", "coder")
            .with_summary("Added login function")
            .with_output("fn login() { ... }");

        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("ok"));
    }
}
