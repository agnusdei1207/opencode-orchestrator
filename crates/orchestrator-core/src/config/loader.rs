//! Configuration loading from multiple sources

use super::OrchestratorConfig;
use crate::{Error, Result};
use std::path::{Path, PathBuf};

/// Configuration loader that merges configs from multiple sources
pub struct ConfigLoader {
    project_dir: PathBuf,
}

impl ConfigLoader {
    /// Create a new config loader
    pub fn new(project_dir: impl AsRef<Path>) -> Self {
        Self {
            project_dir: project_dir.as_ref().to_path_buf(),
        }
    }

    /// Load and merge configuration from all sources
    pub fn load(&self) -> Result<OrchestratorConfig> {
        let mut config = OrchestratorConfig::default();

        // Load user config first
        if let Some(user_config) = self.load_user_config()? {
            config = self.merge_configs(config, user_config);
        }

        // Load project config (takes precedence)
        if let Some(project_config) = self.load_project_config()? {
            config = self.merge_configs(config, project_config);
        }

        Ok(config)
    }

    /// Load user-level configuration
    fn load_user_config(&self) -> Result<Option<OrchestratorConfig>> {
        let user_config_dir = self.get_user_config_dir()?;
        self.load_config_from_dir(&user_config_dir)
    }

    /// Load project-level configuration
    fn load_project_config(&self) -> Result<Option<OrchestratorConfig>> {
        // Check .opencode/orchestrator.json first
        let opencode_dir = self.project_dir.join(".opencode");
        if let Some(config) = self.load_config_from_dir(&opencode_dir)? {
            return Ok(Some(config));
        }

        // Fallback to project root
        self.load_config_from_dir(&self.project_dir)
    }

    /// Load config from a directory (supports .json and .jsonc)
    fn load_config_from_dir(&self, dir: &Path) -> Result<Option<OrchestratorConfig>> {
        // JSONC takes priority
        let jsonc_path = dir.join("orchestrator.jsonc");
        if jsonc_path.exists() {
            return self.load_jsonc(&jsonc_path).map(Some);
        }

        let json_path = dir.join("orchestrator.json");
        if json_path.exists() {
            return self.load_json(&json_path).map(Some);
        }

        Ok(None)
    }

    /// Load JSON config
    fn load_json(&self, path: &Path) -> Result<OrchestratorConfig> {
        let content = std::fs::read_to_string(path)?;
        serde_json::from_str(&content).map_err(|e| Error::Config(format!("{}: {}", path.display(), e)))
    }

    /// Load JSONC config (JSON with comments)
    fn load_jsonc(&self, path: &Path) -> Result<OrchestratorConfig> {
        let content = std::fs::read_to_string(path)?;
        let stripped = Self::strip_jsonc_comments(&content);
        serde_json::from_str(&stripped).map_err(|e| Error::Config(format!("{}: {}", path.display(), e)))
    }

    /// Strip comments from JSONC content
    fn strip_jsonc_comments(content: &str) -> String {
        let mut result = String::with_capacity(content.len());
        let mut chars = content.chars().peekable();
        let mut in_string = false;
        let mut escape_next = false;

        while let Some(c) = chars.next() {
            if escape_next {
                result.push(c);
                escape_next = false;
                continue;
            }

            if c == '\\' && in_string {
                result.push(c);
                escape_next = true;
                continue;
            }

            if c == '"' {
                in_string = !in_string;
                result.push(c);
                continue;
            }

            if !in_string && c == '/' {
                if let Some(&next) = chars.peek() {
                    if next == '/' {
                        // Line comment - skip until newline
                        chars.next();
                        while let Some(&ch) = chars.peek() {
                            if ch == '\n' {
                                break;
                            }
                            chars.next();
                        }
                        continue;
                    } else if next == '*' {
                        // Block comment - skip until */
                        chars.next();
                        loop {
                            match chars.next() {
                                Some('*') => {
                                    if chars.peek() == Some(&'/') {
                                        chars.next();
                                        break;
                                    }
                                }
                                None => break,
                                _ => {}
                            }
                        }
                        continue;
                    }
                }
            }

            result.push(c);
        }

        // Handle trailing commas
        Self::strip_trailing_commas(&result)
    }

    /// Strip trailing commas from JSON
    fn strip_trailing_commas(content: &str) -> String {
        let re = regex::Regex::new(r",(\s*[}\]])").unwrap();
        re.replace_all(content, "$1").to_string()
    }

    /// Merge two configs (b takes precedence)
    fn merge_configs(&self, a: OrchestratorConfig, b: OrchestratorConfig) -> OrchestratorConfig {
        let mut merged = a;

        // Override simple fields
        merged.google_auth = b.google_auth;
        merged.auto_update = b.auto_update;

        // Merge maps
        merged.agents.extend(b.agents);
        merged.skills.extend(b.skills);
        merged.categories.extend(b.categories);

        // Append lists
        merged.disabled_hooks.extend(b.disabled_hooks);
        merged.disabled_skills.extend(b.disabled_skills);

        // Override complex configs
        if b.schema.is_some() {
            merged.schema = b.schema;
        }
        merged.claude_code = b.claude_code;
        merged.experimental = b.experimental;
        merged.comment_checker = b.comment_checker;
        merged.ralph_loop = b.ralph_loop;
        merged.orchestrator_agent = b.orchestrator_agent;
        merged.git_master = b.git_master;
        merged.notification = b.notification;

        merged
    }

    /// Get user config directory
    fn get_user_config_dir(&self) -> Result<PathBuf> {
        if let Ok(home) = std::env::var("HOME") {
            return Ok(PathBuf::from(home).join(".config").join("opencode"));
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            return Ok(PathBuf::from(appdata).join("opencode"));
        }
        Err(Error::Config("Could not determine user config directory".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_line_comments() {
        let input = r#"{
            // This is a comment
            "key": "value"
        }"#;
        let result = ConfigLoader::strip_jsonc_comments(input);
        assert!(!result.contains("//"));
        assert!(result.contains("\"key\""));
    }

    #[test]
    fn test_strip_block_comments() {
        let input = r#"{
            /* Block comment */
            "key": "value"
        }"#;
        let result = ConfigLoader::strip_jsonc_comments(input);
        assert!(!result.contains("/*"));
        assert!(result.contains("\"key\""));
    }

    #[test]
    fn test_strip_trailing_commas() {
        let input = r#"{"key": "value",}"#;
        let result = ConfigLoader::strip_trailing_commas(input);
        assert_eq!(result, r#"{"key": "value"}"#);
    }
}
