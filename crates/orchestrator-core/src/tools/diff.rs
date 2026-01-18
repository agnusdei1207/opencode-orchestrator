//! Diff tool - compare files or strings

use crate::Result;
use std::path::Path;
use std::process::Command;

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
}

impl Default for DiffConfig {
    fn default() -> Self {
        Self {
            unified: true,
            context_lines: 3,
            ignore_whitespace: false,
            ignore_case: false,
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
        
        cmd.arg(file1).arg(file2);
        
        let output = cmd.output()?;
        let diff_output = String::from_utf8_lossy(&output.stdout).to_string();
        let has_differences = !output.status.success();
        
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

    /// Compare two strings
    pub fn diff_strings(&self, content1: &str, content2: &str) -> Result<DiffResult> {
        use std::io::Write;
        
        let tmp_dir = std::env::temp_dir();
        let file1 = tmp_dir.join("diff_a.tmp");
        let file2 = tmp_dir.join("diff_b.tmp");
        
        std::fs::write(&file1, content1)?;
        std::fs::write(&file2, content2)?;
        
        let result = self.diff_files(&file1, &file2);
        
        let _ = std::fs::remove_file(&file1);
        let _ = std::fs::remove_file(&file2);
        
        result
    }
}

impl Default for DiffTool {
    fn default() -> Self {
        Self::new(DiffConfig::default())
    }
}
