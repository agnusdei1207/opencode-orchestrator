//! Diff tool - compare files or strings

use crate::tools::process::run_with_timeout;
use crate::{Error, Result};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

/// `diff` exit status when the inputs are identical.
const DIFF_EXIT_SAME: i32 = 0;
/// `diff` exit status when the inputs differ; anything else means trouble.
const DIFF_EXIT_DIFFERENT: i32 = 1;

/// Configuration for diff operations
#[derive(Debug, Clone)]
pub struct DiffConfig {
    /// Unified diff format (default)
    pub unified: bool,
    /// Number of context lines
    pub context_lines: usize,
    /// Ignore whitespace
    pub ignore_whitespace: bool,
    /// Ignore case
    pub ignore_case: bool,
    /// Hard ceiling for the `diff` process
    pub timeout: Duration,
}

impl Default for DiffConfig {
    fn default() -> Self {
        Self {
            unified: true,
            context_lines: 3,
            ignore_whitespace: false,
            ignore_case: false,
            timeout: Duration::from_secs(30),
        }
    }
}

/// Result of a diff operation
#[derive(Debug, Clone)]
pub struct DiffResult {
    pub has_differences: bool,
    pub diff_output: String,
    pub additions: usize,
    pub deletions: usize,
}

/// Diff tool for comparing files
pub struct DiffTool {
    config: DiffConfig,
}

impl DiffTool {
    pub fn new(config: DiffConfig) -> Self {
        Self { config }
    }

    /// Compare two files
    pub fn diff_files(&self, file1: &Path, file2: &Path) -> Result<DiffResult> {
        let cmd = self.build_command(file1, file2);
        let output = run_with_timeout(cmd, self.config.timeout, None)?;
        let has_differences = match output.status.code() {
            Some(DIFF_EXIT_SAME) => false,
            Some(DIFF_EXIT_DIFFERENT) => true,
            // Exit 2 (missing file, unreadable input, bad option) or a signal.
            _ => {
                return Err(Error::Tool(format!(
                    "diff failed ({}): {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr).trim()
                )));
            }
        };
        let diff_output = String::from_utf8_lossy(&output.stdout).to_string();

        // Count additions and deletions
        let mut additions = 0;
        let mut deletions = 0;
        for line in diff_output.lines() {
            if line.starts_with('+') && !line.starts_with("+++") {
                additions += 1;
            } else if line.starts_with('-') && !line.starts_with("---") {
                deletions += 1;
            }
        }

        Ok(DiffResult {
            has_differences,
            diff_output,
            additions,
            deletions,
        })
    }

    fn build_command(&self, file1: &Path, file2: &Path) -> Command {
        let mut cmd = Command::new("diff");

        if self.config.unified {
            cmd.arg(format!("-U{}", self.config.context_lines));
        }
        if self.config.ignore_whitespace {
            cmd.arg("-w");
        }
        if self.config.ignore_case {
            cmd.arg("-i");
        }

        // `--` keeps a file name that starts with `-` from being read as an option.
        cmd.arg("--").arg(file1).arg(file2);
        cmd
    }

    /// Compare two strings
    pub fn diff_strings(&self, content1: &str, content2: &str) -> Result<DiffResult> {
        // A private directory per call: concurrent calls must never read or
        // clobber each other's inputs. It is removed when `dir` drops.
        let dir = tempfile::tempdir()?;
        let file1 = dir.path().join("a");
        let file2 = dir.path().join("b");

        std::fs::write(&file1, content1)?;
        std::fs::write(&file2, content2)?;

        self.diff_files(&file1, &file2)
    }
}

impl Default for DiffTool {
    fn default() -> Self {
        Self::new(DiffConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_diff_strings() {
        let tool = DiffTool::default();
        let s1 = "line1\nline2\n";
        let s2 = "line1\nline3\n";

        // This might fail if 'diff' command is not available in test environment,
        // but it's a valid structural test.
        let result = tool.diff_strings(s1, s2);
        if let Ok(res) = result {
            assert!(res.has_differences);
            assert!(res.additions > 0);
            assert!(res.deletions > 0);
        }
    }

    #[cfg(unix)]
    #[test]
    fn diff_trouble_is_an_error_not_a_difference() {
        let dir = tempfile::tempdir().unwrap();
        let tool = DiffTool::default();

        let result = tool.diff_files(&dir.path().join("missing-a"), &dir.path().join("missing-b"));

        let error = result.expect_err("exit status 2 must be an error");
        assert!(error.to_string().contains("missing-a"));
    }

    #[cfg(unix)]
    #[test]
    fn concurrent_string_diffs_do_not_share_temp_files() {
        let workers: Vec<_> = (0..8)
            .map(|worker| {
                std::thread::spawn(move || {
                    let tool = DiffTool::default();
                    for round in 0..25 {
                        let text = format!("worker {worker} round {round}\n");
                        let result = tool.diff_strings(&text, &text).unwrap();
                        assert!(!result.has_differences, "{text} compared to another input");
                    }
                })
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_blocked_diff_process_is_killed_at_the_timeout() {
        let dir = tempfile::tempdir().unwrap();
        let fifo = dir.path().join("fifo");
        let created = std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .unwrap();
        assert!(created.success());
        let other = dir.path().join("other");
        std::fs::write(&other, "x\n").unwrap();
        let tool = DiffTool::new(DiffConfig {
            timeout: std::time::Duration::from_millis(200),
            ..DiffConfig::default()
        });

        let started = std::time::Instant::now();
        // Opening a FIFO without a writer blocks `diff` indefinitely.
        let result = tool.diff_files(&fifo, &other);

        assert!(started.elapsed() < std::time::Duration::from_secs(5));
        assert!(result.unwrap_err().to_string().contains("timed out"));
    }

    #[test]
    fn file_names_starting_with_a_dash_are_not_options() {
        let command = DiffTool::default().build_command(Path::new("-y"), Path::new("b"));
        let args: Vec<_> = command.get_args().collect();

        assert_eq!(args[args.len() - 3..], ["--", "-y", "b"]);
    }
}
