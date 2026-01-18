//! Git operations tool

use crate::Result;
use std::path::Path;
use std::process::Command;

/// Git diff statistics
#[derive(Debug, Clone)]
pub struct GitDiffStats {
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
    pub diff_output: String,
}

/// Git file status
#[derive(Debug, Clone)]
pub struct GitFileStatus {
    pub file: String,
    pub status: String, // M, A, D, R, C, U, ?
}

/// Git tool for repository operations
pub struct GitTool;

impl GitTool {
    pub fn new() -> Self {
        Self
    }

    /// Get diff for uncommitted changes
    pub fn diff(&self, repo_path: &Path, staged_only: bool) -> Result<GitDiffStats> {
        let mut cmd = Command::new("git");
        cmd.current_dir(repo_path);
        cmd.arg("diff");
        
        if staged_only {
            cmd.arg("--staged");
        }
        
        let output = cmd.output()?;
        let diff_output = String::from_utf8_lossy(&output.stdout).to_string();
        
        // Get stats
        let mut stats_cmd = Command::new("git");
        stats_cmd.current_dir(repo_path);
        stats_cmd.args(["diff", "--stat"]);
        if staged_only {
            stats_cmd.arg("--staged");
        }
        
        let stats_output = stats_cmd.output()?;
        let stats_text = String::from_utf8_lossy(&stats_output.stdout);
        
        // Parse stats from last line (e.g., "3 files changed, 10 insertions(+), 5 deletions(-)")
        let (files_changed, insertions, deletions) = self.parse_stat_line(&stats_text);
        
        Ok(GitDiffStats {
            files_changed,
            insertions,
            deletions,
            diff_output,
        })
    }

    /// Get status of files
    pub fn status(&self, repo_path: &Path) -> Result<Vec<GitFileStatus>> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain"])
            .output()?;
        
        let text = String::from_utf8_lossy(&output.stdout);
        let mut files = Vec::new();
        
        for line in text.lines() {
            if line.len() >= 3 {
                let status = line[0..2].trim().to_string();
                let file = line[3..].to_string();
                files.push(GitFileStatus { file, status });
            }
        }
        
        Ok(files)
    }

    /// Get recent commits
    pub fn log(&self, repo_path: &Path, count: usize) -> Result<Vec<String>> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["log", "--oneline", "-n", &count.to_string()])
            .output()?;
        
        let text = String::from_utf8_lossy(&output.stdout);
        Ok(text.lines().map(|s| s.to_string()).collect())
    }

    /// Get current branch
    pub fn current_branch(&self, repo_path: &Path) -> Result<String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .output()?;
        
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// Get list of modified files
    pub fn modified_files(&self, repo_path: &Path) -> Result<Vec<String>> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["diff", "--name-only"])
            .output()?;
        
        let text = String::from_utf8_lossy(&output.stdout);
        Ok(text.lines().filter(|s| !s.is_empty()).map(|s| s.to_string()).collect())
    }

    fn parse_stat_line(&self, text: &str) -> (usize, usize, usize) {
        let last_line = text.lines().last().unwrap_or("");
        
        let mut files = 0;
        let mut insertions = 0;
        let mut deletions = 0;
        
        for part in last_line.split(',') {
            let part = part.trim();
            if part.contains("file") {
                files = part.split_whitespace().next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if part.contains("insertion") {
                insertions = part.split_whitespace().next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if part.contains("deletion") {
                deletions = part.split_whitespace().next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            }
        }
        
        (files, insertions, deletions)
    }
}

impl Default for GitTool {
    fn default() -> Self {
        Self::new()
    }
}
