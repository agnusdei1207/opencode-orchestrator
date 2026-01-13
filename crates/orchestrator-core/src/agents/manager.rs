//! Agent manager for creating and managing agent instances

use super::{Agent, AgentId};
use crate::config::OrchestratorConfig;
use std::collections::HashMap;

/// Manager for agent instances
pub struct AgentManager {
    agents: HashMap<AgentId, Agent>,
    config: OrchestratorConfig,
}

impl AgentManager {
    /// Create a new agent manager with configuration
    pub fn new(config: OrchestratorConfig) -> Self {
        let mut manager = Self {
            agents: HashMap::new(),
            config,
        };
        manager.initialize_agents();
        manager
    }

    /// Initialize all built-in agents (6-agent architecture)
    fn initialize_agents(&mut self) {
        // 6-agent collaborative architecture
        for id in AgentId::all() {
            let mut agent = Agent::new(*id);
            self.apply_overrides(&mut agent);
            self.agents.insert(*id, agent);
        }
    }

    /// Apply configuration overrides to an agent
    fn apply_overrides(&self, agent: &mut Agent) {
        let agent_key = agent.id.to_string();
        if let Some(overrides) = self.config.agents.get(&agent_key) {
            if let Some(ref model) = overrides.model {
                agent.model = model.clone();
            }
            if let Some(ref prompt) = overrides.system_prompt {
                agent.system_prompt = prompt.clone();
            }
            if let Some(allow_write) = overrides.allow_write {
                agent.permissions.write = allow_write;
            }
            if let Some(allow_bash) = overrides.allow_bash {
                agent.permissions.bash = allow_bash;
            }
            if let Some(max_tokens) = overrides.max_tokens {
                agent.max_tokens = Some(max_tokens);
            }
            if let Some(temperature) = overrides.temperature {
                agent.temperature = Some(temperature);
            }
        }
    }

    /// Get an agent by ID
    pub fn get(&self, id: AgentId) -> Option<&Agent> {
        self.agents.get(&id)
    }

    /// Get a mutable agent by ID
    pub fn get_mut(&mut self, id: AgentId) -> Option<&mut Agent> {
        self.agents.get_mut(&id)
    }

    /// Get all agents suitable for background execution
    pub fn background_agents(&self) -> Vec<&Agent> {
        self.agents
            .values()
            .filter(|a| a.id.can_run_in_background())
            .collect()
    }

    /// Get agent by string name
    pub fn get_by_name(&self, name: &str) -> Option<&Agent> {
        self.agents.values().find(|a| a.id.to_string() == name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_manager_initialization() {
        let config = OrchestratorConfig::default();
        let manager = AgentManager::new(config);

        assert!(manager.get(AgentId::Orchestrator).is_some());
        assert!(manager.get(AgentId::Coder).is_some());
        assert!(manager.get(AgentId::Fixer).is_some());
    }

    #[test]
    fn test_agent_overrides() {
        let mut config = OrchestratorConfig::default();
        config.agents.insert(
            "coder".to_string(),
            crate::config::AgentOverride {
                model: Some("custom/model".to_string()),
                ..Default::default()
            },
        );

        let manager = AgentManager::new(config);
        let coder = manager.get(AgentId::Coder).unwrap();
        assert_eq!(coder.model, "custom/model");
    }

    #[test]
    fn test_get_by_name() {
        let config = OrchestratorConfig::default();
        let manager = AgentManager::new(config);

        assert!(manager.get_by_name("coder").is_some());
        assert!(manager.get_by_name("planner").is_some());
        assert!(manager.get_by_name("fixer").is_some());
        assert!(manager.get_by_name("nonexistent").is_none());
    }
}
