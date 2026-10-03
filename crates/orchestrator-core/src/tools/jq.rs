//! JSON Query tool (jq-like)

use crate::tools::process::{CapturedText, run_with_timeout};
use crate::{Error, Result};
use std::fs::File;
use std::io::{self, Read};
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
    pub fn query(&self, json_input: &str, expression: &str) -> Result<CapturedText> {
        let cmd = self.build_command(expression);
        let output = run_with_timeout(cmd, JQ_TIMEOUT, Some(json_input.as_bytes()))?;

        if !output.status.success() {
            return Err(Error::Tool(format!(
                "jq error: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        let mut captured = output.stdout_text();
        captured.text = captured.text.trim().to_string();
        Ok(captured)
    }

    /// Query JSON file with jq expression. The file is read here and piped to
    /// jq, so its path never reaches the jq command line.
    pub fn query_file(&self, file_path: &Path, expression: &str) -> Result<CapturedText> {
        let content = read_input_file(file_path)?;
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

/// Read a regular file of at most [`MAX_INPUT_FILE_BYTES`].
///
/// The cap counts the bytes actually read, because `metadata().len()` is 0
/// for `/proc` files and devices such as `/dev/zero`. FIFOs and devices are
/// refused before opening: opening a FIFO blocks until a writer appears, and
/// this read happens before jq's timeout starts.
fn read_input_file(path: &Path) -> Result<String> {
    if !std::fs::metadata(path)?.file_type().is_file() {
        return Err(Error::Tool(format!(
            "jq input {} is not a regular file",
            path.display()
        )));
    }
    let mut bytes = Vec::new();
    File::open(path)?
        .take(MAX_INPUT_FILE_BYTES + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_INPUT_FILE_BYTES {
        return Err(Error::Tool(format!(
            "jq input file {} exceeds the {MAX_INPUT_FILE_BYTES}-byte limit",
            path.display()
        )));
    }
    String::from_utf8(bytes).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err).into())
}

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
        assert_eq!(result.text, "42");
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
        assert_eq!(result.text, "opencode");
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

    /// `query_file` on another thread, so a blocking read fails the test
    /// instead of hanging it.
    #[cfg(unix)]
    fn query_file_within(path: &Path, limit: Duration) -> Result<CapturedText> {
        let path = path.to_path_buf();
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let _ = sender.send(JqTool::default().query_file(&path, "."));
        });
        receiver
            .recv_timeout(limit)
            .expect("query_file must not block on a special file")
    }

    #[cfg(unix)]
    #[test]
    fn fifos_are_refused_instead_of_blocking() {
        let dir = tempfile::tempdir().unwrap();
        let fifo = dir.path().join("input.json");
        let created = Command::new("mkfifo").arg(&fifo).status().unwrap();
        assert!(created.success());

        let error = query_file_within(&fifo, Duration::from_secs(2)).unwrap_err();

        assert!(error.to_string().contains("not a regular file"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn devices_that_report_zero_length_are_refused() {
        let error = query_file_within(Path::new("/dev/zero"), Duration::from_secs(2)).unwrap_err();

        assert!(error.to_string().contains("not a regular file"), "{error}");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn zero_length_proc_files_are_read_up_to_their_real_content() {
        // `/proc` files report a length of 0 but still have content.
        let content = read_input_file(Path::new("/proc/self/status")).unwrap();

        assert!(content.contains("Name:"), "{content}");
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
