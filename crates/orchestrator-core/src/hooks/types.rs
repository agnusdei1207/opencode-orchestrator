//! Hook Definitions
//!
//! Hooks are features that run automatically before/after tool execution.
//! Each hook serves a specific purpose in the orchestration workflow.

use serde::{Deserialize, Serialize};

/// Available hooks
///
/// Each hook runs automatically in specific situations.
/// Can be disabled in configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Hook {
    // ══════════════════════════════════════════════════════════════════════
    // 🔄 Autonomous Execution
    // ══════════════════════════════════════════════════════════════════════
    /// **Autonomous Loop** - AI continues execution until task complete
    ///
    /// Config: `auto.enabled`, `auto.max_iterations`
    Auto,
}

impl std::fmt::Display for Hook {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Auto => "auto",
        };
        write!(f, "{}", name)
    }
}

impl Hook {
    /// Get hook description
    pub fn description(&self) -> &'static str {
        match self {
            Self::Auto => "AI continues execution until task complete (autonomous loop)",
        }
    }

    /// Get all hooks
    pub fn all() -> &'static [Hook] {
        &[Self::Auto]
    }
}

/// Hook execution timing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookTiming {
    /// Before tool execution
    Before,
    /// After tool execution
    After,
}

/// Hook execution result
#[derive(Debug, Clone)]
pub enum HookResult {
    /// Continue execution
    Continue,
    /// Block execution
    Block(String),
    /// Modify output
    Modify(serde_json::Value),
    /// Warning message
    Warn(String),
}

impl Default for HookResult {
    fn default() -> Self {
        Self::Continue
    }
}

/// Tool execution context
#[derive(Debug, Clone)]
pub struct ToolContext {
    /// Tool name
    pub tool: String,
    /// Session ID
    pub session_id: Option<String>,
    /// Tool arguments
    pub args: serde_json::Value,
    /// Working directory
    pub directory: String,
}

/// Hook output
#[derive(Debug, Clone, Default)]
pub struct HookOutput {
    /// Modified arguments
    pub args: Option<serde_json::Value>,
    /// Message to inject
    pub message: Option<String>,
    /// Whether to block execution
    pub block: bool,
    /// Warning
    pub warning: Option<String>,
}

impl HookOutput {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }

    pub fn blocked(mut self) -> Self {
        self.block = true;
        self
    }
}
