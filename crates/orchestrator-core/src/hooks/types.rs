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
