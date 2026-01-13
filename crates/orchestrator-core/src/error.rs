//! Error types for OpenCode Orchestrator

use thiserror::Error;

/// Result type alias for orchestrator operations
pub type Result<T> = std::result::Result<T, Error>;

/// Main error type for the orchestrator
#[derive(Error, Debug)]
pub enum Error {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Agent error: {0}")]
    Agent(String),

    #[error("Tool execution error: {0}")]
    Tool(String),

    #[error("Hook error: {0}")]
    Hook(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Regex error: {0}")]
    Regex(#[from] regex::Error),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("LSP error: {0}")]
    Lsp(String),

    #[error("Background task error: {0}")]
    BackgroundTask(String),

    #[error("Skill error: {0}")]
    Skill(String),

    #[error("MCP error: {0}")]
    Mcp(String),
}

impl Error {
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    pub fn agent(msg: impl Into<String>) -> Self {
        Self::Agent(msg.into())
    }

    pub fn tool(msg: impl Into<String>) -> Self {
        Self::Tool(msg.into())
    }

    pub fn hook(msg: impl Into<String>) -> Self {
        Self::Hook(msg.into())
    }
}
