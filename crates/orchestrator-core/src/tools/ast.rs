//! AST tools - structural search and replace using ast-grep

use crate::tools::process::run_with_timeout;
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

/// A single AST match result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstMatch {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub content: String,
    pub matched_text: String,
}

/// Configuration for AST tools
#[derive(Debug, Clone)]
pub struct AstConfig {
    pub timeout: Duration,
    pub max_results: usize,
}

impl Default for AstConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            max_results: 100,
        }
    }
}

/// AST tool for structural search and replace
pub struct AstTool {
    config: AstConfig,
}

impl AstTool {
    pub fn new(config: AstConfig) -> Self {
        Self { config }
    }

    /// Search for structural patterns using ast-grep
    pub fn search(
        &self,
        pattern: &str,
        directory: &Path,
        lang: Option<&str>,
        include: Option<&str>,
    ) -> Result<Vec<AstMatch>> {
        let lang = lang.unwrap_or("typescript");

        let mut args = vec![
            "-y".to_string(),
            "--package".to_string(),
            "@ast-grep/cli".to_string(),
            "ast-grep".to_string(),
            "run".to_string(),
            "--pattern".to_string(),
            pattern.to_string(),
            "--lang".to_string(),
            lang.to_string(),
            "--json".to_string(),
        ];

        if let Some(inc) = include {
            args.push("--globs".to_string());
            args.push(inc.to_string());
        }

        let mut cmd = Command::new("npx");
        cmd.args(&args).current_dir(directory);
        let output = run_with_timeout(cmd, self.config.timeout, None)?;

        // ast-grep uses exit 1 for a valid search with no matches.
        if !output.status.success() && output.status.code() != Some(1) {
            return Err(Error::Tool(format!(
                "ast-grep search failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        self.parse_ast_grep_output(&stdout)
    }

    /// Replace structural patterns using ast-grep
    pub fn replace(
        &self,
        pattern: &str,
        rewrite: &str,
        directory: &Path,
        lang: Option<&str>,
        include: Option<&str>,
    ) -> Result<AstReplaceResult> {
        let lang = lang.unwrap_or("typescript");

        let mut args = vec![
            "-y".to_string(),
            "--package".to_string(),
            "@ast-grep/cli".to_string(),
            "ast-grep".to_string(),
            "run".to_string(),
            "--pattern".to_string(),
            pattern.to_string(),
            "--rewrite".to_string(),
            rewrite.to_string(),
            "--lang".to_string(),
            lang.to_string(),
            "--update-all".to_string(),
        ];

        if let Some(inc) = include {
            args.push("--globs".to_string());
            args.push(inc.to_string());
        }

        let mut cmd = Command::new("npx");
        cmd.args(&args).current_dir(directory);
        let output = run_with_timeout(cmd, self.config.timeout, None)?;

        let success = output.status.success() || output.status.code() == Some(1);
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(AstReplaceResult {
            success,
            message: if success {
                format!(
                    "AST replace completed. Pattern: `{}` -> `{}`",
                    pattern, rewrite
                )
            } else {
                stderr.clone()
            },
            stdout,
            stderr,
        })
    }

    /// Parse ast-grep JSON output
    fn parse_ast_grep_output(&self, output: &str) -> Result<Vec<AstMatch>> {
        let mut matches = Vec::new();

        let results = serde_json::from_str::<Vec<AstGrepMatch>>(output)?;
        for result in results.into_iter().take(self.config.max_results) {
            matches.push(AstMatch {
                file: result.file,
                line: result.range.start.line,
                column: result.range.start.column,
                content: result.text.clone(),
                matched_text: result.text,
            });
        }

        Ok(matches)
    }
}

impl Default for AstTool {
    fn default() -> Self {
        Self::new(AstConfig::default())
    }
}

/// Result of AST replace operation
#[derive(Debug, Clone, Serialize)]
pub struct AstReplaceResult {
    pub success: bool,
    pub message: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Deserialize)]
struct AstGrepMatch {
    file: String,
    text: String,
    range: AstGrepRange,
}

#[derive(Deserialize)]
struct AstGrepRange {
    start: AstGrepPosition,
    #[allow(dead_code)]
    end: AstGrepPosition,
}

#[derive(Deserialize)]
struct AstGrepPosition {
    line: u32,
    column: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn with_fixture<T>(script: &str, execute: impl FnOnce(&Path) -> T) -> T {
        use std::os::unix::fs::PermissionsExt;
        static PATH_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _guard = PATH_LOCK.lock().unwrap();
        let directory = tempfile::tempdir().unwrap();
        let executable = directory.path().join("npx");
        std::fs::write(&executable, format!("#!/bin/sh\n{script}\n")).unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
        let previous = std::env::var_os("PATH").unwrap_or_default();
        let mut paths = vec![directory.path().to_path_buf()];
        paths.extend(std::env::split_paths(&previous));
        // Only this fixture uses npx; serialize its temporary PATH override.
        unsafe { std::env::set_var("PATH", std::env::join_paths(paths).unwrap()) };
        let result = execute(directory.path());
        unsafe { std::env::set_var("PATH", previous) };
        result
    }

    #[cfg(unix)]
    fn search_with_fixture(script: &str) -> Result<Vec<AstMatch>> {
        with_fixture(script, |directory| {
            AstTool::default().search("fixture", directory, None, Some("*.ts"))
        })
    }

    #[test]
    #[cfg(unix)]
    fn replacement_with_no_matches_is_a_successful_noop() {
        let result = with_fixture("exit 1", |directory| {
            AstTool::default().replace("fixture", "replacement", directory, None, None)
        })
        .unwrap();
        assert!(result.success);
    }

    #[test]
    #[cfg(unix)]
    fn failed_ast_cli_is_not_an_empty_search_result() {
        let result = search_with_fixture("echo '[]'; echo 'ast unavailable' >&2; exit 2");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("ast unavailable"));
    }

    #[test]
    #[cfg(unix)]
    fn malformed_ast_cli_output_is_not_an_empty_search_result() {
        assert!(search_with_fixture("echo 'not JSON'").is_err());
    }

    #[test]
    #[cfg(unix)]
    fn successful_empty_ast_search_remains_empty() {
        assert!(search_with_fixture("echo '[]'; exit 1").unwrap().is_empty());
    }

    #[test]
    #[cfg(unix)]
    fn invokes_the_ast_grep_package_with_its_supported_glob_option() {
        let matches = search_with_fixture(r#"printf '[{"file":"test.ts","text":"%s","range":{"start":{"line":0,"column":0},"end":{"line":0,"column":1}}}]' "$*""#).unwrap();
        assert!(
            matches[0]
                .matched_text
                .contains("--package @ast-grep/cli ast-grep run")
        );
        assert!(matches[0].matched_text.contains("--globs *.ts"));
    }

    #[test]
    fn test_ast_match_deserialization() {
        let json = r#"{
            "matched_text": "code",
            "content": "line of code",
            "line": 1,
            "column": 1,
            "file": "test.js"
        }"#;
        let m: AstMatch = serde_json::from_str(json).unwrap();
        assert_eq!(m.matched_text, "code");
        assert_eq!(m.file, "test.js");
    }
}
