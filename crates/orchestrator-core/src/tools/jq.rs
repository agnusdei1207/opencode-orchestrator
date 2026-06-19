//! JSON Query tool (jq-like)

use crate::Result;
use crate::tools::process::run_with_timeout;
use std::process::Command;
use std::time::Duration;

/// Hard ceiling for a single `jq` invocation.
const JQ_TIMEOUT: Duration = Duration::from_secs(30);

/// Configuration for jq operations
#[derive(Debug, Clone, Default)]
pub struct JqConfig {
    /// Raw output (no JSON encoding for strings)
    pub raw_output: bool,
    /// Compact output
    pub compact: bool,
    /// Sort keys
    pub sort_keys: bool,
}

/// JSON Query tool using jq
pub struct JqTool {
    config: JqConfig,
}

impl JqTool {
    pub fn new(config: JqConfig) -> Self {
        Self { config }
    }

    /// Query JSON string with jq expression
    pub fn query(&self, json_input: &str, expression: &str) -> Result<String> {
        let mut cmd = Command::new("jq");

        if self.config.raw_output {
            cmd.arg("-r");
        }
        if self.config.compact {
            cmd.arg("-c");
        }
        if self.config.sort_keys {
            cmd.arg("-S");
        }

        cmd.arg(expression);

        let output = run_with_timeout(cmd, JQ_TIMEOUT, Some(json_input.as_bytes()))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(crate::Error::Tool(format!(
                "jq error: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    /// Query JSON file with jq expression
    pub fn query_file(&self, file_path: &std::path::Path, expression: &str) -> Result<String> {
        let content = std::fs::read_to_string(file_path)?;
        self.query(&content, expression)
    }

    /// Pretty print JSON
    pub fn pretty_print(&self, json_input: &str) -> Result<String> {
        self.query(json_input, ".")
    }

    /// Get value at path (e.g., ".foo.bar[0]")
    pub fn get_value(&self, json_input: &str, path: &str) -> Result<String> {
        self.query(json_input, path)
    }

    /// Set value at path
    pub fn set_value(&self, json_input: &str, path: &str, value: &str) -> Result<String> {
        let expression = format!("{} = {}", path, value);
        self.query(json_input, &expression)
    }
}

impl Default for JqTool {
    fn default() -> Self {
        Self::new(JqConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn jq_available() -> bool {
        Command::new("jq").arg("--version").output().is_ok()
    }

    #[test]
    fn extracts_a_nested_value() {
        if !jq_available() {
            return;
        }
        let tool = JqTool::default();
        let result = tool.query(r#"{"foo": {"bar": 42}}"#, ".foo.bar").unwrap();
        assert_eq!(result, "42");
    }

    #[test]
    fn raw_output_drops_string_quotes() {
        if !jq_available() {
            return;
        }
        let tool = JqTool::new(JqConfig {
            raw_output: true,
            ..JqConfig::default()
        });
        let result = tool.query(r#"{"name": "opencode"}"#, ".name").unwrap();
        assert_eq!(result, "opencode");
    }

    #[test]
    fn invalid_expression_returns_error() {
        if !jq_available() {
            return;
        }
        let tool = JqTool::default();
        assert!(tool.query("{}", ".[").is_err());
    }
}
