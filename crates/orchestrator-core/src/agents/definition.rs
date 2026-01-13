//! Agent definitions - 6-Agent Micro-Tasking Architecture
//!
//! Optimized for small models (GLM-4.7, etc.)
//! Key Principle: Ultra-granular tasks that any model can execute
//! - ONE file per task
//! - ONE function per task
//! - MAX 5 minutes per task

use serde::{Deserialize, Serialize};
use std::fmt;

/// 6 Specialized Agents for Micro-Tasking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentId {
    // ═══════════════════════════════════════════════════════════════
    // COORDINATION
    // ═══════════════════════════════════════════════════════════════

    /// **Orchestrator** - Traffic controller
    ///
    /// Routes tasks to appropriate agents.
    /// NEVER does actual work - only delegates.
    /// Keeps track of progress and decides next agent.
    Orchestrator,

    // ═══════════════════════════════════════════════════════════════
    // PLANNING - Micro-Tasking Specialist
    // ═══════════════════════════════════════════════════════════════

    /// **Planner** - Micro-task decomposition expert
    ///
    /// Breaks tasks into ATOMIC units:
    /// - ONE file per task
    /// - ONE function per task
    /// - MAX 10 lines of code
    /// - MAX 5 minutes per task
    ///
    /// Small models can't understand big picture.
    /// Planner creates a step-by-step recipe.
    Planner,

    // ═══════════════════════════════════════════════════════════════
    // EXECUTION - Single-Focus Specialist
    // ═══════════════════════════════════════════════════════════════

    /// **Coder** - Single-file, single-function specialist
    ///
    /// Only does ONE thing at a time:
    /// - Touch ONE file
    /// - Modify ONE function
    /// - Add ONE feature
    ///
    /// Never touches multiple files in one task.
    Coder,

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION - Comprehensive Quality Gate
    // ═══════════════════════════════════════════════════════════════

    /// **Reviewer** - Comprehensive quality gate
    ///
    /// Checks EVERYTHING after each Coder task:
    /// - Syntax errors
    /// - Type errors  
    /// - Logic errors
    /// - Code style consistency
    /// - Naming conventions
    /// - Modern patterns (latest stack)
    /// - Security issues
    /// - Performance red flags
    ///
    /// Must run after EVERY Coder task.
    Reviewer,

    // ═══════════════════════════════════════════════════════════════
    // ERROR HANDLING - One-Error-At-A-Time
    // ═══════════════════════════════════════════════════════════════

    /// **Fixer** - Minimal error resolution specialist
    ///
    /// When Reviewer finds issues:
    /// - Takes ONE error only
    /// - Analyzes root cause
    /// - Fixes ONLY that error
    /// - No refactoring, no improvements
    ///
    /// Small models can't debug multiple errors at once.
    Fixer,

    // ═══════════════════════════════════════════════════════════════
    // SUPPORT - Context Provider
    // ═══════════════════════════════════════════════════════════════

    /// **Searcher** - Find context in codebase
    ///
    /// Before coding, find:
    /// - Existing patterns to follow
    /// - Similar implementations
    /// - Files to modify
    /// - Import patterns
    Searcher,
}

impl fmt::Display for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Orchestrator => write!(f, "orchestrator"),
            Self::Planner => write!(f, "planner"),
            Self::Coder => write!(f, "coder"),
            Self::Reviewer => write!(f, "reviewer"),
            Self::Fixer => write!(f, "fixer"),
            Self::Searcher => write!(f, "searcher"),
        }
    }
}

impl AgentId {
    /// Default model - uses OpenCode /connect model
    pub fn default_model(&self) -> &'static str {
        "default"
    }

    /// Agent description
    pub fn description(&self) -> &'static str {
        match self {
            Self::Orchestrator => "Traffic controller - routes tasks, NEVER does work",
            Self::Planner => "Micro-task decomposition - 1 file, 1 function, 5 min max",
            Self::Coder => "Single-focus execution - 1 file, 1 function at a time",
            Self::Reviewer => "Quality gate - style, errors, modern stack, security",
            Self::Fixer => "Minimal fixes - 1 error at a time, no refactoring",
            Self::Searcher => "Context provider - find patterns before coding",
        }
    }

    /// All agents
    pub fn all() -> &'static [AgentId] {
        &[
            Self::Orchestrator,
            Self::Planner,
            Self::Coder,
            Self::Reviewer,
            Self::Fixer,
            Self::Searcher,
        ]
    }

    /// Can run in background
    pub fn can_run_in_background(&self) -> bool {
        matches!(self, Self::Searcher)
    }
}

/// Agent permissions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissions {
    pub write: bool,
    pub bash: bool,
}

impl Default for AgentPermissions {
    fn default() -> Self {
        Self { write: false, bash: false }
    }
}

impl AgentPermissions {
    pub fn full() -> Self {
        Self { write: true, bash: true }
    }
    
    pub fn code() -> Self {
        Self { write: true, bash: true }
    }
    
    pub fn read_only() -> Self {
        Self::default()
    }
    
    pub fn verify() -> Self {
        Self { write: false, bash: true } // can run tests
    }
}

/// Agent definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: AgentId,
    pub model: String,
    pub system_prompt: String,
    pub permissions: AgentPermissions,
    pub description: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

impl Agent {
    pub fn new(id: AgentId) -> Self {
        Self {
            model: id.default_model().to_string(),
            system_prompt: String::new(),
            permissions: match id {
                AgentId::Orchestrator => AgentPermissions::read_only(),
                AgentId::Planner => AgentPermissions::read_only(),
                AgentId::Coder => AgentPermissions::code(),
                AgentId::Reviewer => AgentPermissions::verify(),
                AgentId::Fixer => AgentPermissions::code(),
                AgentId::Searcher => AgentPermissions::read_only(),
            },
            description: id.description().to_string(),
            max_tokens: None,
            temperature: None,
            id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_count() {
        assert_eq!(AgentId::all().len(), 6);
    }

    #[test]
    fn test_agent_display() {
        assert_eq!(AgentId::Orchestrator.to_string(), "orchestrator");
        assert_eq!(AgentId::Planner.to_string(), "planner");
        assert_eq!(AgentId::Coder.to_string(), "coder");
        assert_eq!(AgentId::Reviewer.to_string(), "reviewer");
        assert_eq!(AgentId::Fixer.to_string(), "fixer");
        assert_eq!(AgentId::Searcher.to_string(), "searcher");
    }

    #[test]
    fn test_agent_permissions() {
        let orchestrator = Agent::new(AgentId::Orchestrator);
        assert!(!orchestrator.permissions.write);
        assert!(!orchestrator.permissions.bash);

        let coder = Agent::new(AgentId::Coder);
        assert!(coder.permissions.write);
        assert!(coder.permissions.bash);

        let reviewer = Agent::new(AgentId::Reviewer);
        assert!(!reviewer.permissions.write);
        assert!(reviewer.permissions.bash); // can run tests
    }
}
