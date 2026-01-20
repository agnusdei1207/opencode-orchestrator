//! AST tools - structural search and replace using ast-grep

use crate::Result;
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
            "ast-grep".to_string(),
            "run".to_string(),
            "--pattern".to_string(),
            pattern.to_string(),
            "--lang".to_string(),
            lang.to_string(),
            "--json".to_string(),
        ];

        if let Some(inc) = include {
            args.push("--include".to_string());
            args.push(inc.to_string());
        }

        let output = Command::new("npx")
            .args(&args)
            .current_dir(directory)
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        
        Ok(self.parse_ast_grep_output(&stdout))
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
            args.push("--include".to_string());
            args.push(inc.to_string());
        }

        let output = Command::new("npx")
            .args(&args)
            .current_dir(directory)
            .output()?;

        let success = output.status.success();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(AstReplaceResult {
            success,
            message: if success {
                format!("AST replace completed. Pattern: `{}` -> `{}`", pattern, rewrite)
            } else {
                stderr.clone()
            },
            stdout,
            stderr,
        })
    }

    /// Parse ast-grep JSON output
    fn parse_ast_grep_output(&self, output: &str) -> Vec<AstMatch> {
        let mut matches = Vec::new();

        // Try to parse as JSON array
        if let Ok(results) = serde_json::from_str::<Vec<AstGrepMatch>>(output) {
            for result in results.into_iter().take(self.config.max_results) {
                matches.push(AstMatch {
                    file: result.file,
                    line: result.range.start.line,
                    column: result.range.start.column,
                    content: result.text.clone(),
                    matched_text: result.text,
                });
            }
        }

        matches
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
