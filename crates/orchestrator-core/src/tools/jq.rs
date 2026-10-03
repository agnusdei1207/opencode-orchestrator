//! JSON Query tool (jq-like)

use crate::tools::process::run_with_timeout;
use crate::{Error, Result};
use std::path::Path;
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
        let cmd = self.build_command(expression);
        let output = run_with_timeout(cmd, JQ_TIMEOUT, Some(json_input.as_bytes()))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(Error::Tool(format!(
                "jq error: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    /// Query JSON file with jq expression. The file is read here and piped to
    /// jq, so its path never reaches the jq command line.
    pub fn query_file(&self, file_path: &Path, expression: &str) -> Result<String> {
        let size = std::fs::metadata(file_path)?.len();
        if size > MAX_INPUT_FILE_BYTES {
            return Err(Error::Tool(format!(
                "jq input file {} is {size} bytes, which exceeds the {MAX_INPUT_FILE_BYTES}-byte limit",
                file_path.display()
            )));
        }
        let content = std::fs::read_to_string(file_path)?;
        self.query(&content, expression)
    }

    fn build_command(&self, expression: &str) -> Command {
        let mut cmd = Command::new("jq");
        restrict_environment(&mut cmd);
        if self.config.raw_output {
            cmd.arg("-r");
        }
        if self.config.compact {
            cmd.arg("-c");
        }
        if self.config.sort_keys {
            cmd.arg("-S");
        }
        // jq parses any argument starting with `-` as an option, and jq 1.6
        // rejects `--` before the filter. Leading whitespace is insignificant
        // to the jq grammar, so it keeps every filter positional.
        cmd.arg(format!(" {expression}"));
        cmd
    }
}

/// The only variables jq sees, so `$ENV`/`env` cannot read the server's
/// secrets. `SYSTEMROOT` is required by Windows executables to start.
const JQ_ENV_ALLOWLIST: &[&str] = &["PATH", "SYSTEMROOT"];
/// Largest JSON file `query_file` loads into memory.
const MAX_INPUT_FILE_BYTES: u64 = 16 * 1024 * 1024;

fn restrict_environment(cmd: &mut Command) {
    cmd.env_clear();
    for key in JQ_ENV_ALLOWLIST {
        if let Some(value) = std::env::var_os(key) {
            cmd.env(key, value);
        }
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

    #[cfg(unix)]
    #[test]
    fn child_environment_keeps_only_the_allowlist() {
        let mut command = Command::new("env");
        restrict_environment(&mut command);
        let output = command.output().unwrap();
        let text = String::from_utf8_lossy(&output.stdout);

        assert!(text.lines().any(|line| line.starts_with("PATH=")));
        assert!(
            text.lines()
                .all(|line| JQ_ENV_ALLOWLIST.iter().any(|key| line.starts_with(key))),
            "unexpected variables reached jq: {text}"
        );
    }

    #[test]
    fn filters_starting_with_a_dash_stay_positional() {
        let command = JqTool::default().build_command("--rawfile");
        let args: Vec<_> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();

        assert!(!args.iter().any(|arg| arg == "--rawfile"));
        assert_eq!(args.last().unwrap().trim(), "--rawfile");
    }

    #[test]
    fn oversized_input_files_are_rejected_before_running_jq() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("big.json");
        std::fs::File::create(&file)
            .unwrap()
            .set_len(MAX_INPUT_FILE_BYTES + 1)
            .unwrap();

        let error = JqTool::default().query_file(&file, ".").unwrap_err();

        assert!(error.to_string().contains("exceeds"), "{error}");
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
