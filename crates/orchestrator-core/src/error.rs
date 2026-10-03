//! Error types for OpenCode Orchestrator

use thiserror::Error;

/// Result type alias for orchestrator operations
pub type Result<T> = std::result::Result<T, Error>;

/// Main error type for the orchestrator
#[derive(Error, Debug)]
pub enum Error {
    #[error("Tool execution error: {0}")]
    Tool(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Regex error: {0}")]
    Regex(#[from] regex::Error),
}
