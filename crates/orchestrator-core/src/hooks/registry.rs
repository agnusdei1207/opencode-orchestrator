//! Hook Registry
//!
//! Manages hook activation/deactivation

use super::types::Hook;
use std::collections::HashSet;

/// Hook registry for managing enabled/disabled hooks
#[derive(Debug, Clone)]
pub struct HookRegistry {
    disabled: HashSet<Hook>,
}

impl Default for HookRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl HookRegistry {
    pub fn new() -> Self {
        Self {
            disabled: HashSet::new(),
        }
    }

    /// Initialize from list of disabled hook names
    pub fn from_disabled(disabled_hooks: &[String]) -> Self {
        let mut registry = Self::new();
        for hook_name in disabled_hooks {
            if let Some(hook) = Self::parse_hook_name(hook_name) {
                registry.disable(hook);
            }
        }
        registry
    }

    /// Parse hook name to Hook enum
    fn parse_hook_name(name: &str) -> Option<Hook> {
        match name {
            // Autonomous execution
            "auto" => Some(Hook::Auto), // AI continues execution until task complete
            _ => None,
        }
    }

    pub fn enable(&mut self, hook: Hook) {
        self.disabled.remove(&hook);
    }

    pub fn disable(&mut self, hook: Hook) {
        self.disabled.insert(hook);
    }

    pub fn is_enabled(&self, hook: Hook) -> bool {
        !self.disabled.contains(&hook)
    }

    pub fn enabled_hooks(&self) -> Vec<Hook> {
        Hook::all()
            .iter()
            .copied()
            .filter(|h| self.is_enabled(*h))
            .collect()
    }

    pub fn disabled_hooks(&self) -> Vec<Hook> {
        self.disabled.iter().copied().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_registry() {
        let mut registry = HookRegistry::new();
        assert!(registry.is_enabled(Hook::Auto));

        registry.disable(Hook::Auto);
        assert!(!registry.is_enabled(Hook::Auto));

        registry.enable(Hook::Auto);
        assert!(registry.is_enabled(Hook::Auto));
    }

    #[test]
    fn test_from_disabled() {
        let disabled = vec!["auto".to_string()];
        let registry = HookRegistry::from_disabled(&disabled);
        assert!(!registry.is_enabled(Hook::Auto));
    }
}
