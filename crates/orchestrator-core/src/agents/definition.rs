//! Agent definitions - 6-Agent Micro-Tasking Architecture
//!
//! Optimized for small models (GLM-4.7, etc.)
//! Key Principle: Ultra-granular tasks that any model can execute
//! - ONE file per task
//! - ONE function per task
//! - RELENTLESS execution until 100% completion

use serde::{Deserialize, Serialize};
use std::fmt;

/// 6 Specialized Agents for Micro-Tasking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentId {
    // ═══════════════════════════════════════════════════════════════
    // COORDINATION
    // ═══════════════════════════════════════════════════════════════

    /// **Orchestrator** - Mission Commander
    ///
    /// Manages the Mission and parallel execution streams.
    /// NEVER does work - only schedules and verifies.
    Orchestrator,

    // ═══════════════════════════════════════════════════════════════
    // PLANNING
    // ═══════════════════════════════════════════════════════════════

    /// **Planner** - The Architect
    ///
    /// Decomposes work into a JSON-based Task Flow.
    /// Focuses on ultra-granular micro-tasks.
    Planner,

    // ═══════════════════════════════════════════════════════════════
    // EXECUTION
    // ═══════════════════════════════════════════════════════════════

    /// **Coder** - Implementation Specialist
    ///
    /// Executes single atomic tasks with complete, working code.
    Coder,

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════

    /// **Reviewer** - Style Guardian
    ///
    /// The absolute gatekeeper. Enforces perfection and style consistency.
    /// Checks: Syntax, Style, Logic, Integrity, Security.
    Reviewer,

    // ═══════════════════════════════════════════════════════════════
    // REPAIR
    // ═══════════════════════════════════════════════════════════════

    /// **Fixer** - Targeted Repair
    ///
    /// Applies minimal fixes based on specific Reviewer feedback.
    Fixer,

    // ═══════════════════════════════════════════════════════════════
    // SUPPORT
    // ═══════════════════════════════════════════════════════════════

    /// **Searcher** - Context Oracle
    ///
    /// Gather code patterns and documentation before implementation.
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
            Self::Orchestrator => "Mission Commander - manages tasks and parallel execution",
            Self::Planner => "The Architect - JSON-based Task Flow decomposition",
            Self::Coder => "Execution Specialist - atomic task implementation",
            Self::Reviewer => "Style Guardian - zero-tolerance quality gate",
            Self::Fixer => "Targeted Repair - minimal fix application",
            Self::Searcher => "Context Oracle - proactive code pattern gathering",
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
    /// Dynamic context injected by Orchestrator at runtime
    /// This contains task-specific instructions that change per invocation
    #[serde(default)]
    pub runtime_context: RuntimeContext,
}

/// Runtime context injected by Orchestrator when delegating to agents
/// This allows dynamic, task-specific instructions
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RuntimeContext {
    /// Environment info (OS, Docker/local, build command)
    pub environment: Option<String>,
    /// FIXED zones that must not be modified
    pub fixed_zones: Vec<String>,
    /// MODIFIABLE zones that can be changed
    pub modifiable_zones: Vec<String>,
    /// Current task description
    pub current_task: Option<String>,
    /// Task dependencies context
    pub dependencies_context: Option<String>,
    /// Specific instructions for this invocation
    pub additional_instructions: Option<String>,
    /// Error context (for Fixer)
    pub error_context: Option<String>,
}

impl RuntimeContext {
    /// Create empty context
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Build context with environment
    pub fn with_environment(mut self, env: impl Into<String>) -> Self {
        self.environment = Some(env.into());
        self
    }
    
    /// Add fixed zones
    pub fn with_fixed_zones(mut self, zones: Vec<String>) -> Self {
        self.fixed_zones = zones;
        self
    }
    
    /// Add current task
    pub fn with_task(mut self, task: impl Into<String>) -> Self {
        self.current_task = Some(task.into());
        self
    }
    
    /// Add additional instructions
    pub fn with_instructions(mut self, instructions: impl Into<String>) -> Self {
        self.additional_instructions = Some(instructions.into());
        self
    }
    
    /// Add error context (for Fixer)
    pub fn with_error(mut self, error: impl Into<String>) -> Self {
        self.error_context = Some(error.into());
        self
    }
    
    /// Format context as a string to append to system prompt
    pub fn to_prompt_section(&self) -> String {
        let mut sections = Vec::new();
        
        if let Some(ref env) = self.environment {
            sections.push(format!("## Current Environment\n{}", env));
        }
        
        if !self.fixed_zones.is_empty() {
            sections.push(format!(
                "## FIXED ZONES (DO NOT MODIFY)\n- {}",
                self.fixed_zones.join("\n- ")
            ));
        }
        
        if !self.modifiable_zones.is_empty() {
            sections.push(format!(
                "## MODIFIABLE ZONES\n- {}",
                self.modifiable_zones.join("\n- ")
            ));
        }
        
        if let Some(ref task) = self.current_task {
            sections.push(format!("## Current Task\n{}", task));
        }
        
        if let Some(ref deps) = self.dependencies_context {
            sections.push(format!("## Dependencies Context\n{}", deps));
        }
        
        if let Some(ref instructions) = self.additional_instructions {
            sections.push(format!("## Additional Instructions\n{}", instructions));
        }
        
        if let Some(ref error) = self.error_context {
            sections.push(format!("## Error to Fix\n{}", error));
        }
        
        if sections.is_empty() {
            String::new()
        } else {
            format!("\n\n---\n# RUNTIME CONTEXT\n\n{}", sections.join("\n\n"))
        }
    }
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
            runtime_context: RuntimeContext::default(),
            id,
        }
    }
    
    /// Get full prompt including runtime context
    pub fn full_prompt(&self) -> String {
        let context_section = self.runtime_context.to_prompt_section();
        format!("{}{}", self.system_prompt, context_section)
    }
    
    /// Set runtime context for this invocation
    pub fn with_context(mut self, context: RuntimeContext) -> Self {
        self.runtime_context = context;
        self
    }
    
    /// Update runtime context
    pub fn set_context(&mut self, context: RuntimeContext) {
        self.runtime_context = context;
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
