//! AST tools - structural search and replace using ast-grep

use crate::tools::process::{CapturedOutput, run_with_timeout};
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
    pub matched_text: String,
}

/// Exact ast-grep release run through npx, so a new upstream release cannot
/// change behavior (or exit codes) underneath the tool.
const AST_GREP_PACKAGE: &str = "@ast-grep/cli@0.45.3";
/// `ast-grep run` exit status when nothing matched (with or without
/// `--update-all`); 0 means matches, 2 a usage error, other codes failures.
const NO_MATCH_EXIT_CODE: i32 = 1;
/// How errors name the ast-grep CLI.
const AST_GREP_TOOL_NAME: &str = "ast-grep";

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

/// Where and on which files an ast-grep run operates.
#[derive(Debug, Clone, Copy)]
pub struct AstScope<'a> {
    /// Working directory of the ast-grep process
    pub directory: &'a Path,
    /// Language passed to `--lang`; defaults to `typescript`
    pub lang: Option<&'a str>,
    /// Glob passed to `--globs`, if any
    pub include: Option<&'a str>,
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
    pub fn search(&self, pattern: &str, scope: AstScope<'_>) -> Result<Vec<AstMatch>> {
        let lang = scope.lang.unwrap_or("typescript");

        let args = vec![
            "-y".to_string(),
            "--package".to_string(),
            AST_GREP_PACKAGE.to_string(),
            "ast-grep".to_string(),
            "run".to_string(),
            "--pattern".to_string(),
            pattern.to_string(),
            "--lang".to_string(),
            lang.to_string(),
            "--json".to_string(),
        ];

        let cmd = ast_grep_command(args, scope);
        let output = run_with_timeout(cmd, self.config.timeout, None)?;

        if !ran_to_completion(&output) {
            return Err(Error::Tool(format!(
                "ast-grep search failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }

        let stdout = output.complete_stdout(AST_GREP_TOOL_NAME)?;

        self.parse_ast_grep_output(&stdout)
    }

    /// Replace structural patterns using ast-grep
    pub fn replace(
        &self,
        pattern: &str,
        rewrite: &str,
        scope: AstScope<'_>,
    ) -> Result<AstReplaceResult> {
        let lang = scope.lang.unwrap_or("typescript");

        let args = vec![
            "-y".to_string(),
            "--package".to_string(),
            AST_GREP_PACKAGE.to_string(),
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

        let cmd = ast_grep_command(args, scope);
        let output = run_with_timeout(cmd, self.config.timeout, None)?;

        let success = ran_to_completion(&output);
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

/// Whether ast-grep itself ran: success, or its silent "no matches" exit.
/// npx also exits 1 when it cannot install or start ast-grep, but then it
/// writes `npm error ...` to stderr.
fn ran_to_completion(output: &CapturedOutput) -> bool {
    output.status.success()
        || (output.status.code() == Some(NO_MATCH_EXIT_CODE)
            && output.stderr.trim_ascii().is_empty())
}

/// Build the `npx` invocation from `args`, appending the scope's `--globs`
/// filter and running in the scope's directory.
fn ast_grep_command(mut args: Vec<String>, scope: AstScope<'_>) -> Command {
    if let Some(inc) = scope.include {
        args.push("--globs".to_string());
        args.push(inc.to_string());
    }

    let mut cmd = Command::new("npx");
    cmd.args(&args).current_dir(scope.directory);
    cmd
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
            let scope = AstScope {
                directory,
                lang: None,
                include: Some("*.ts"),
            };
            AstTool::default().search("fixture", scope)
        })
    }

    #[test]
    #[cfg(unix)]
    fn replacement_with_no_matches_is_a_successful_noop() {
        let result = with_fixture("exit 1", |directory| {
            let scope = AstScope {
                directory,
                lang: None,
                include: None,
            };
            AstTool::default().replace("fixture", "replacement", scope)
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
    fn ast_json_beyond_the_capture_limit_is_a_size_error_not_a_parse_error() {
        let script = "printf '['; head -c 16777300 /dev/zero | tr '\\0' ' '";
        let error = search_with_fixture(script).unwrap_err().to_string();
        assert!(
            error.contains("ast-grep output exceeded 16777216 bytes"),
            "{error}"
        );
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
                .contains("--package @ast-grep/cli@0.45.3 ast-grep run")
        );
        assert!(matches[0].matched_text.contains("--globs *.ts"));
    }

    #[test]
    #[cfg(unix)]
    fn npx_failures_are_not_successful_replacements() {
        let result = with_fixture("echo 'npm error notarget' >&2; exit 1", |directory| {
            let scope = AstScope {
                directory,
                lang: None,
                include: None,
            };
            AstTool::default().replace("fixture", "replacement", scope)
        })
        .unwrap();
        assert!(!result.success);
        assert!(result.message.contains("npm error"));
    }

    #[test]
    #[cfg(unix)]
    fn npx_failures_are_search_errors_that_name_the_cause() {
        let error = search_with_fixture("echo 'npm error notarget' >&2; exit 1").unwrap_err();
        assert!(error.to_string().contains("npm error"), "{error}");
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
