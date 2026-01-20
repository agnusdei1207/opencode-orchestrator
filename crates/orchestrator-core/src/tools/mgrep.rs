//! Multi-pattern grep tool (mgrep)
//! 
//! Searches for multiple patterns in parallel using rayon.

use crate::Result;
use rayon::prelude::*;
use regex::Regex;
use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Configuration for mgrep operations
#[derive(Debug, Clone)]
pub struct MgrepConfig {
    pub timeout: Duration,
    pub max_results_per_pattern: usize,
    pub max_file_size: u64,
    pub include_hidden: bool,
    pub exclude_patterns: Vec<String>,
}

impl Default for MgrepConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(60),
            max_results_per_pattern: 50,
            max_file_size: 10 * 1024 * 1024,
            include_hidden: false,
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/.git/**".to_string(),
                "**/target/**".to_string(),
                "**/dist/**".to_string(),
            ],
        }
    }
}


/// A single match result
#[derive(Debug, Clone)]
pub struct MgrepMatch {
    pub pattern: String,
    pub file: String,
    pub line: usize,
    pub content: String,
}

/// Multi-grep results grouped by pattern
#[derive(Debug, Clone, Default)]
pub struct MgrepResult {
    pub results: HashMap<String, Vec<MgrepMatch>>,
}

/// Multi-pattern grep tool
pub struct MgrepTool {
    config: MgrepConfig,
}

impl MgrepTool {
    pub fn new(config: MgrepConfig) -> Self {
        Self { config }
    }

    /// Search for multiple patterns in parallel
    pub fn search(&self, patterns: &[String], directory: &Path) -> Result<MgrepResult> {
        let start = Instant::now();
        
        // Compile all patterns
        let regexes: Vec<(String, Regex)> = patterns
            .iter()
            .filter_map(|p| Regex::new(p).ok().map(|r| (p.clone(), r)))
            .collect();

        // Collect all files first
        let files: Vec<_> = WalkDir::new(directory)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| self.should_include(e.path()))
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.metadata()
                    .map(|m| m.len() <= self.config.max_file_size)
                    .unwrap_or(false)
            })
            .map(|e| e.path().to_path_buf())
            .collect();

        // Search in parallel
        let results: HashMap<String, Vec<MgrepMatch>> = regexes
            .par_iter()
            .map(|(pattern, regex)| {
                let mut matches = Vec::new();
                
                for file_path in &files {
                    if start.elapsed() > self.config.timeout {
                        break;
                    }
                    if matches.len() >= self.config.max_results_per_pattern {
                        break;
                    }

                    if let Ok(content) = std::fs::read_to_string(file_path) {
                        for (line_num, line) in content.lines().enumerate() {
                            if regex.is_match(line) {
                                matches.push(MgrepMatch {
                                    pattern: pattern.clone(),
                                    file: file_path.display().to_string(),
                                    line: line_num + 1,
                                    content: line.to_string(),
                                });

                                if matches.len() >= self.config.max_results_per_pattern {
                                    break;
                                }
                            }
                        }
                    }
                }

                (pattern.clone(), matches)
            })
            .collect();

        Ok(MgrepResult { results })
    }

    fn should_include(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();
        
        // Check hidden files
        if !self.config.include_hidden {
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    return false;
                }
            }
        }

        // Check exclude patterns
        for pattern in &self.config.exclude_patterns {
            if glob::Pattern::new(pattern)
                .map(|p| p.matches(&path_str))
                .unwrap_or(false)
            {
                return false;
            }
        }

        true
    }

}

impl Default for MgrepTool {
    fn default() -> Self {
        Self::new(MgrepConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_mgrep_basic() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.ts");
        fs::write(&file, "const foo = 1;\nlet bar = 2;\nconst baz = 3;").unwrap();

        // Use config that includes hidden files (tempdir may be hidden)
        let config = MgrepConfig {
            include_hidden: true,
            exclude_patterns: vec![],
            ..Default::default()
        };

        let tool = MgrepTool::new(config);
        let result = tool.search(
            &["const".to_string(), "let".to_string()],
            dir.path(),
        ).unwrap();

        assert!(result.results.contains_key("const"));
        assert!(result.results.contains_key("let"));
        assert_eq!(result.results["const"].len(), 2);
        assert_eq!(result.results["let"].len(), 1);
    }
}

