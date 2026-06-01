//! LSP Diagnostics tool - runs tsc and eslint to get errors/warnings

use crate::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

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

impl DiagnosticsTool {
    pub fn new(config: DiagnosticsConfig) -> Self {
        Self { config }
    }

    /// Get diagnostics for a directory
    pub fn get_diagnostics(&self, directory: &Path, file_filter: Option<&str>) -> Result<Vec<Diagnostic>> {
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
        if let Some(filter) = file_filter {
            if filter != "*" {
                all_diagnostics.retain(|d| d.file.contains(filter) || d.file.ends_with(filter));
            }
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
        let output = Command::new("npx")
            .args(["-y", "tsc", "--noEmit", "--pretty", "false"])
            .current_dir(directory)
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{}{}", stdout, stderr);

        Ok(self.parse_tsc_output(&combined))
    }

    /// Parse TypeScript compiler output
    fn parse_tsc_output(&self, output: &str) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();
        
        // TSC format: file(line,col): error TS1234: message
        let re = Regex::new(r"^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$").unwrap();

        for line in output.lines() {
            if let Some(caps) = re.captures(line.trim()) {
                let severity = match caps.get(4).map(|m| m.as_str()) {
                    Some("error") => DiagnosticSeverity::Error,
                    Some("warning") => DiagnosticSeverity::Warning,
                    _ => DiagnosticSeverity::Info,
                };

                diagnostics.push(Diagnostic {
                    file: caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                    line: caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0),
                    column: caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0),
                    severity,
                    message: caps.get(6).map(|m| m.as_str().to_string()).unwrap_or_default(),
                    source: Some("typescript".to_string()),
                    code: caps.get(5).map(|m| m.as_str().to_string()),
                });
            }
        }

        diagnostics
    }

    /// Run ESLint
    fn run_eslint(&self, directory: &Path, file_filter: Option<&str>) -> Result<Vec<Diagnostic>> {
        let target = file_filter.unwrap_or(".");
        
        let output = Command::new("npx")
            .args(["-y", "eslint", target, "--format", "json", "--no-error-on-unmatched-pattern"])
            .current_dir(directory)
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        
        Ok(self.parse_eslint_output(&stdout))
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
