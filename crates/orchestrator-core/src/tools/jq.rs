//! JSON Query tool (jq-like)

use crate::Result;
use std::process::Command;

/// Configuration for jq operations
#[derive(Debug, Clone)]
pub struct JqConfig {
    /// Raw output (no JSON encoding for strings)
    pub raw_output: bool,
    /// Compact output
    pub compact: bool,
    /// Sort keys
    pub sort_keys: bool,
}

impl Default for JqConfig {
    fn default() -> Self {
        Self {
            raw_output: false,
            compact: false,
            sort_keys: false,
        }
    }
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
        
        use std::io::Write;
        use std::process::Stdio;
        
        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(json_input.as_bytes())?;
        }
        
        let output = child.wait_with_output()?;
        
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
