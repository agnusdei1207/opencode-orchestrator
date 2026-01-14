//! Configuration schema definitions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Main configuration for OpenCode Orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct OrchestratorConfig {
    /// JSON Schema URL for IDE autocomplete
    #[serde(rename = "$schema", skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,

    /// Enable Google Antigravity auth
    #[serde(default = "default_true")]
    pub google_auth: bool,

    /// Agent overrides
    #[serde(default)]
    pub agents: HashMap<String, AgentOverride>,

    /// Disabled hooks
    #[serde(default)]
    pub disabled_hooks: Vec<String>,

    /// Disabled skills
    #[serde(default)]
    pub disabled_skills: Vec<String>,

    /// Skill configurations
    #[serde(default)]
    pub skills: HashMap<String, SkillConfig>,

    /// Category configurations
    #[serde(default)]
    pub categories: HashMap<String, CategoryConfig>,

    /// Claude Code compatibility settings
    #[serde(default)]
    pub claude_code: ClaudeCodeConfig,

    /// Experimental features
    #[serde(default)]
    pub experimental: ExperimentalConfig,

    /// Comment checker settings
    #[serde(default)]
    pub comment_checker: CommentCheckerConfig,

    /// Ralph loop settings
    #[serde(default)]
    pub ralph_loop: RalphLoopConfig,

    /// Orchestrator agent settings
    #[serde(default)]
    pub orchestrator_agent: OrchestratorAgentConfig,

    /// Git master settings
    #[serde(default)]
    pub git_master: GitMasterConfig,

    /// Notification settings
    #[serde(default)]
    pub notification: NotificationConfig,

    /// Auto update setting
    #[serde(default = "default_true")]
    pub auto_update: bool,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            schema: None,
            google_auth: true,
            agents: HashMap::new(),
            disabled_hooks: Vec::new(),
            disabled_skills: Vec::new(),
            skills: HashMap::new(),
            categories: HashMap::new(),
            claude_code: ClaudeCodeConfig::default(),
            experimental: ExperimentalConfig::default(),
            comment_checker: CommentCheckerConfig::default(),
            ralph_loop: RalphLoopConfig::default(),
            orchestrator_agent: OrchestratorAgentConfig::default(),
            git_master: GitMasterConfig::default(),
            notification: NotificationConfig::default(),
            auto_update: true,
        }
    }
}

/// Agent override configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct AgentOverride {
    /// Model to use (e.g., "openai/gpt-5.2")
    pub model: Option<String>,

    /// Custom system prompt
    pub system_prompt: Option<String>,

    /// Whether to allow file writes
    pub allow_write: Option<bool>,

    /// Whether to allow bash commands
    pub allow_bash: Option<bool>,

    /// Maximum tokens for response
    pub max_tokens: Option<u32>,

    /// Temperature for generation
    pub temperature: Option<f32>,
}

/// Skill configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct SkillConfig {
    pub enabled: bool,
    pub model: Option<String>,
    pub mcp: Option<HashMap<String, McpServerConfig>>,
}

/// Category configuration for task delegation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct CategoryConfig {
    pub agent: String,
    pub description: Option<String>,
    pub keywords: Vec<String>,
}

/// MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// Claude Code compatibility configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ClaudeCodeConfig {
    pub mcp: bool,
    pub commands: bool,
    pub skills: bool,
    pub agents: bool,
    pub hooks: bool,
    pub plugins: bool,
    #[serde(default)]
    pub plugins_override: HashMap<String, bool>,
}

impl Default for ClaudeCodeConfig {
    fn default() -> Self {
        Self {
            mcp: true,
            commands: true,
            skills: true,
            agents: true,
            hooks: true,
            plugins: true,
            plugins_override: HashMap::new(),
        }
    }
}

/// Experimental features configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ExperimentalConfig {
    /// Use DCP for compaction
    pub dcp_for_compaction: bool,
}

/// Comment checker configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CommentCheckerConfig {
    pub enabled: bool,
    pub strictness: CommentStrictness,
}

impl Default for CommentCheckerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            strictness: CommentStrictness::Normal,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CommentStrictness {
    Lenient,
    #[default]
    Normal,
    Strict,
}

/// Ralph loop configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct RalphLoopConfig {
    pub enabled: bool,
    pub default_max_iterations: u32,
}

impl Default for RalphLoopConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            default_max_iterations: 100,
        }
    }
}

/// Orchestrator agent configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct OrchestratorAgentConfig {
    pub disabled: bool,
}

/// Git master configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct GitMasterConfig {
    pub commit_style: Option<String>,
    pub branch_naming: Option<String>,
}

/// Notification configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct NotificationConfig {
    pub force_enable: bool,
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = OrchestratorConfig::default();
        assert!(config.google_auth);
        assert!(config.claude_code.mcp);
        assert!(config.ralph_loop.enabled);
    }

    #[test]
    fn test_deserialize_partial() {
        let json = r#"{"google_auth": false, "agents": {"executor": {"model": "openai/gpt-5.2"}}}"#;
        let config: OrchestratorConfig = serde_json::from_str(json).unwrap();
        assert!(!config.google_auth);
        assert!(config.agents.contains_key("executor"));
    }
}
