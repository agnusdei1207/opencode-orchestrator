//! LSP Diagnostics tool - runs tsc and eslint to get errors/warnings

use crate::{Error, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

/// Diagnostic severity level
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

/// A single diagnostic result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub source: Option<String>,
    pub code: Option<String>,
}

/// Configuration for diagnostics tool
#[derive(Debug, Clone)]
pub struct DiagnosticsConfig {
    pub timeout: Duration,
    pub include_warnings: bool,
    pub max_results: usize,
}

impl Default for DiagnosticsConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            include_warnings: true,
            max_results: 100,
        }
    }
}

/// Diagnostics tool that runs TypeScript and ESLint checks
pub struct DiagnosticsTool {
    config: DiagnosticsConfig,
}

#[derive(Debug)]
struct CommandResult {
    stdout: String,
    stderr: String,
    success: bool,
}

impl DiagnosticsTool {
    pub fn new(config: DiagnosticsConfig) -> Self {
        Self { config }
    }

    /// Get diagnostics for a directory
    pub fn get_diagnostics(
        &self,
        directory: &Path,
        file_filter: Option<&str>,
    ) -> Result<Vec<Diagnostic>> {
        let mut all_diagnostics = Vec::new();

        // Run TypeScript type checking
        if let Ok(tsc_diags) = self.run_tsc(directory) {
            all_diagnostics.extend(tsc_diags);
        }

        // Run ESLint
        if let Ok(eslint_diags) = self.run_eslint(directory, file_filter) {
            all_diagnostics.extend(eslint_diags);
        }

        // Filter by file if specified
        if let Some(filter) = file_filter
            && filter != "*"
        {
            all_diagnostics.retain(|d| {
                d.file.contains(filter)
                    || d.file.ends_with(filter)
                    || d.code.as_deref() == Some("command-failed")
            });
        }

        // Filter warnings if disabled
        if !self.config.include_warnings {
            all_diagnostics.retain(|d| d.severity == DiagnosticSeverity::Error);
        }

        // Limit results
        all_diagnostics.truncate(self.config.max_results);

        Ok(all_diagnostics)
    }

    /// Run TypeScript compiler in noEmit mode
    fn run_tsc(&self, directory: &Path) -> Result<Vec<Diagnostic>> {
        let Some(tsc) = local_node_bin(directory, "tsc") else {
            if has_typescript_config(directory) {
                return Ok(vec![self.command_failure_diagnostic(
                    "typescript",
                    "local TypeScript executable not found in node_modules/.bin",
                )]);
            }

            return Ok(Vec::new());
        };

        let mut command = Command::new(tsc);
        command
            .args(["--noEmit", "--pretty", "false"])
            .current_dir(directory);

        let result = match self.run_command(&mut command) {
            Ok(result) => result,
            Err(err) => {
                return Ok(vec![
                    self.command_failure_diagnostic("typescript", &err.to_string()),
                ]);
            }
        };

        Ok(self.build_tsc_diagnostics(&result))
    }

    fn build_tsc_diagnostics(&self, result: &CommandResult) -> Vec<Diagnostic> {
        let combined = format!("{}{}", result.stdout, result.stderr);
        let diagnostics = self.parse_tsc_output(&combined);
        if !result.success && diagnostics.is_empty() {
            return vec![self.command_failure_diagnostic("typescript", &combined)];
        }

        diagnostics
    }

    /// Parse TypeScript compiler output
    fn parse_tsc_output(&self, output: &str) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();

        // TSC format: file(line,col): error TS1234: message
        let re =
            Regex::new(r"^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$").unwrap();

        for line in output.lines() {
            if let Some(caps) = re.captures(line.trim()) {
                let severity = match caps.get(4).map(|m| m.as_str()) {
                    Some("error") => DiagnosticSeverity::Error,
                    Some("warning") => DiagnosticSeverity::Warning,
                    _ => DiagnosticSeverity::Info,
                };

                diagnostics.push(Diagnostic {
                    file: caps
                        .get(1)
                        .map(|m| m.as_str().to_string())
                        .unwrap_or_default(),
                    line: caps
                        .get(2)
                        .and_then(|m| m.as_str().parse().ok())
                        .unwrap_or(0),
                    column: caps
                        .get(3)
                        .and_then(|m| m.as_str().parse().ok())
                        .unwrap_or(0),
                    severity,
                    message: caps
                        .get(6)
                        .map(|m| m.as_str().to_string())
                        .unwrap_or_default(),
                    source: Some("typescript".to_string()),
                    code: caps.get(5).map(|m| m.as_str().to_string()),
                });
            }
        }

        diagnostics
    }

    /// Run ESLint
    fn run_eslint(&self, directory: &Path, file_filter: Option<&str>) -> Result<Vec<Diagnostic>> {
        if !has_eslint_config(directory) {
            return Ok(Vec::new());
        }

        let Some(eslint) = local_node_bin(directory, "eslint") else {
            return Ok(vec![self.command_failure_diagnostic(
                "eslint",
                "local ESLint executable not found in node_modules/.bin",
            )]);
        };

        let target = file_filter.unwrap_or(".");

        let mut command = Command::new(eslint);
        command
            .args([
                target,
                "--format",
                "json",
                "--no-error-on-unmatched-pattern",
            ])
            .current_dir(directory);

        let result = match self.run_command(&mut command) {
            Ok(result) => result,
            Err(err) => {
                return Ok(vec![
                    self.command_failure_diagnostic("eslint", &err.to_string()),
                ]);
            }
        };

        Ok(self.build_eslint_diagnostics(&result))
    }

    fn build_eslint_diagnostics(&self, result: &CommandResult) -> Vec<Diagnostic> {
        let diagnostics = self.parse_eslint_output(&result.stdout);
        if diagnostics.is_empty() && (!result.success || !result.stdout.trim().is_empty()) {
            let details = format!("{}{}", result.stdout, result.stderr);
            return vec![self.command_failure_diagnostic("eslint", &details)];
        }

        diagnostics
    }

    fn run_command(&self, command: &mut Command) -> Result<CommandResult> {
        let mut child = command
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let start = Instant::now();
        loop {
            if child.try_wait()?.is_some() {
                return command_result_from_output(child.wait_with_output());
            }

            if start.elapsed() >= self.config.timeout {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Error::Tool(format!(
                    "diagnostics command timed out after {}ms",
                    self.config.timeout.as_millis()
                )));
            }

            sleep(Duration::from_millis(10));
        }
    }

    fn command_failure_diagnostic(&self, source: &str, details: &str) -> Diagnostic {
        Diagnostic {
            file: String::new(),
            line: 0,
            column: 0,
            severity: DiagnosticSeverity::Error,
            message: format!(
                "{} diagnostics command failed: {}",
                source,
                Self::summarize(details)
            ),
            source: Some(source.to_string()),
            code: Some("command-failed".to_string()),
        }
    }

    fn summarize(details: &str) -> String {
        let summary = details.trim().replace('\n', " ");
        if summary.is_empty() {
            "no diagnostic output produced".to_string()
        } else {
            summary.chars().take(500).collect()
        }
    }

    /// Parse ESLint JSON output
    fn parse_eslint_output(&self, output: &str) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();

        // Try to parse as JSON array
        if let Ok(files) = serde_json::from_str::<Vec<EslintFile>>(output) {
            for file in files {
                for msg in file.messages {
                    let severity = match msg.severity {
                        2 => DiagnosticSeverity::Error,
                        1 => DiagnosticSeverity::Warning,
                        _ => DiagnosticSeverity::Info,
                    };

                    diagnostics.push(Diagnostic {
                        file: file.file_path.clone(),
                        line: msg.line.unwrap_or(0),
                        column: msg.column.unwrap_or(0),
                        severity,
                        message: msg.message,
                        source: Some("eslint".to_string()),
                        code: msg.rule_id,
                    });
                }
            }
        }

        diagnostics
    }
}

impl Default for DiagnosticsTool {
    fn default() -> Self {
        Self::new(DiagnosticsConfig::default())
    }
}

#[derive(Deserialize)]
struct EslintFile {
    #[serde(rename = "filePath")]
    file_path: String,
    messages: Vec<EslintMessage>,
}

#[derive(Deserialize)]
struct EslintMessage {
    line: Option<u32>,
    column: Option<u32>,
    severity: u32,
    message: String,
    #[serde(rename = "ruleId")]
    rule_id: Option<String>,
}

fn command_result_from_output(output: std::io::Result<Output>) -> Result<CommandResult> {
    let output = output?;
    Ok(CommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
    })
}

fn local_node_bin(directory: &Path, name: &str) -> Option<std::path::PathBuf> {
    let executable = if cfg!(windows) {
        format!("{}.cmd", name)
    } else {
        name.to_string()
    };
    let path = directory.join("node_modules").join(".bin").join(executable);

    path.is_file().then_some(path)
}

fn has_typescript_config(directory: &Path) -> bool {
    directory.join("tsconfig.json").is_file()
}

fn has_eslint_config(directory: &Path) -> bool {
    const CONFIG_FILES: &[&str] = &[
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.cjs",
        "eslint.config.ts",
        "eslint.config.mts",
        "eslint.config.cts",
        ".eslintrc",
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.json",
        ".eslintrc.yaml",
        ".eslintrc.yml",
    ];

    CONFIG_FILES
        .iter()
        .any(|file| directory.join(file).is_file())
        || package_json_has_eslint_config(directory)
}

fn package_json_has_eslint_config(directory: &Path) -> bool {
    let Ok(contents) = std::fs::read_to_string(directory.join("package.json")) else {
        return false;
    };

    serde_json::from_str::<serde_json::Value>(&contents)
        .ok()
        .and_then(|value| value.get("eslintConfig").cloned())
        .is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use tempfile::tempdir;

    #[test]
    fn eslint_failure_with_non_json_output_returns_error_diagnostic() {
        let tool = DiagnosticsTool::default();
        let result = CommandResult {
            stdout: String::new(),
            stderr: "ESLint couldn't find an eslint.config.js file".to_string(),
            success: false,
        };

        let diagnostics = tool.build_eslint_diagnostics(&result);

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Error);
        assert_eq!(diagnostics[0].source.as_deref(), Some("eslint"));
        assert_eq!(diagnostics[0].code.as_deref(), Some("command-failed"));
        assert!(
            diagnostics[0]
                .message
                .contains("eslint diagnostics command failed")
        );
        assert!(diagnostics[0].message.contains("eslint.config.js"));
    }

    #[test]
    fn tsc_failure_without_parseable_diagnostics_returns_error_diagnostic() {
        let tool = DiagnosticsTool::default();
        let result = CommandResult {
            stdout: String::new(),
            stderr: "TypeScript compiler crashed before diagnostics".to_string(),
            success: false,
        };

        let diagnostics = tool.build_tsc_diagnostics(&result);

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Error);
        assert_eq!(diagnostics[0].source.as_deref(), Some("typescript"));
        assert_eq!(diagnostics[0].code.as_deref(), Some("command-failed"));
        assert!(
            diagnostics[0]
                .message
                .contains("TypeScript compiler crashed")
        );
    }

    #[test]
    fn tsc_with_config_and_missing_local_binary_returns_error_diagnostic() {
        let directory = tempdir().expect("create temp diagnostics directory");
        fs::write(directory.path().join("tsconfig.json"), "{}").unwrap();
        let tool = DiagnosticsTool::default();

        let diagnostics = tool.run_tsc(directory.path()).unwrap();

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Error);
        assert_eq!(diagnostics[0].source.as_deref(), Some("typescript"));
        assert_eq!(diagnostics[0].code.as_deref(), Some("command-failed"));
        assert!(
            diagnostics[0]
                .message
                .contains("local TypeScript executable")
        );
    }

    #[test]
    fn command_execution_respects_configured_timeout() {
        let directory = tempdir().expect("create temp diagnostics directory");
        let tool = DiagnosticsTool::new(DiagnosticsConfig {
            timeout: Duration::from_millis(25),
            include_warnings: true,
            max_results: 100,
        });

        let started = Instant::now();
        let mut command = Command::new("sh");
        command
            .args(["-c", "sleep 1"])
            .current_dir(directory.path());
        let result = tool.run_command(&mut command);

        assert!(result.is_err());
        assert!(started.elapsed() < Duration::from_secs(1));
        assert!(result.unwrap_err().to_string().contains("timed out"));
    }

    #[test]
    fn eslint_without_local_config_is_optional() {
        let directory = tempdir().expect("create temp diagnostics directory");
        write_local_bin(
            directory.path(),
            "eslint",
            "#!/bin/sh\necho 'eslint should not run without config' >&2\nexit 2\n",
        );
        let tool = DiagnosticsTool::default();

        let diagnostics = tool.run_eslint(directory.path(), Some(".")).unwrap();

        assert!(diagnostics.is_empty());
    }

    #[test]
    fn eslint_with_config_and_failed_output_returns_error_diagnostic() {
        let directory = tempdir().expect("create temp diagnostics directory");
        fs::write(
            directory.path().join("eslint.config.js"),
            "export default [];",
        )
        .unwrap();
        write_local_bin(
            directory.path(),
            "eslint",
            "#!/bin/sh\necho 'ESLint config failed' >&2\nexit 2\n",
        );
        let tool = DiagnosticsTool::default();

        let diagnostics = tool.run_eslint(directory.path(), Some(".")).unwrap();

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Error);
        assert_eq!(diagnostics[0].source.as_deref(), Some("eslint"));
        assert_eq!(diagnostics[0].code.as_deref(), Some("command-failed"));
        assert!(diagnostics[0].message.contains("ESLint config failed"));
    }

    #[test]
    fn local_tsc_uses_timeout_without_npx_install() {
        let directory = tempdir().expect("create temp diagnostics directory");
        write_local_bin(directory.path(), "tsc", long_running_script());
        let tool = DiagnosticsTool::new(DiagnosticsConfig {
            timeout: Duration::from_millis(100),
            include_warnings: true,
            max_results: 100,
        });

        let started = Instant::now();
        let result = tool.run_tsc(directory.path());

        let diagnostics = result.unwrap();
        assert!(started.elapsed() < Duration::from_secs(1));
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].source.as_deref(), Some("typescript"));
        assert!(diagnostics[0].message.contains("timed out"));
    }

    #[test]
    fn parse_tsc_output_still_extracts_typescript_diagnostics() {
        let tool = DiagnosticsTool::default();

        let diagnostics = tool.parse_tsc_output(
            "src/index.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.",
        );

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].file, "src/index.ts");
        assert_eq!(diagnostics[0].line, 3);
        assert_eq!(diagnostics[0].column, 14);
        assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Error);
        assert_eq!(diagnostics[0].source.as_deref(), Some("typescript"));
        assert_eq!(diagnostics[0].code.as_deref(), Some("TS2322"));
    }

    fn write_local_bin(directory: &Path, name: &str, contents: &str) {
        let bin_dir = directory.join("node_modules").join(".bin");
        fs::create_dir_all(&bin_dir).unwrap();
        let executable = if cfg!(windows) {
            format!("{}.cmd", name)
        } else {
            name.to_string()
        };
        let bin = bin_dir.join(executable);
        fs::write(&bin, contents).unwrap();
        #[cfg(unix)]
        {
            let mut permissions = fs::metadata(&bin).unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(bin, permissions).unwrap();
        }
    }

    fn long_running_script() -> &'static str {
        if cfg!(windows) {
            "@echo off\r\nping -n 60 127.0.0.1 >NUL\r\n"
        } else {
            "#!/bin/sh\nwhile true; do :; done\n"
        }
    }
}
