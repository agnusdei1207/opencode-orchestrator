//! Multi-pattern grep tool (mgrep)
//!
//! Searches for multiple patterns in parallel using rayon.

use crate::Result;
use crate::tools::path_filter::PathFilter;
use rayon::prelude::*;
use regex::Regex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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

        let files = self.collect_files(directory);

        // Search in parallel
        let results: HashMap<String, Vec<MgrepMatch>> = regexes
            .par_iter()
            .map(|compiled| {
                let matches = self.search_pattern(compiled, &files, start);
                (compiled.0.clone(), matches)
            })
            .collect();

        Ok(MgrepResult { results })
    }

    /// Every included regular file whose size is known and within the limit.
    fn collect_files(&self, directory: &Path) -> Vec<PathBuf> {
        let filter = PathFilter::new(directory, &self.config.exclude_patterns)
            .include_hidden(self.config.include_hidden);
        WalkDir::new(directory)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| filter.allows(e.path()))
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.metadata()
                    .map(|m| m.len() <= self.config.max_file_size)
                    .unwrap_or(false)
            })
            .map(|e| e.path().to_path_buf())
            .collect()
    }

    /// Matching lines of one pattern, bounded by the shared deadline and the
    /// per-pattern result limit.
    fn search_pattern(
        &self,
        (pattern, regex): &(String, Regex),
        files: &[PathBuf],
        start: Instant,
    ) -> Vec<MgrepMatch> {
        let limit = self.config.max_results_per_pattern;
        let mut matches = Vec::new();
        for file_path in files {
            if start.elapsed() > self.config.timeout || matches.len() >= limit {
                break;
            }
            let Ok(content) = std::fs::read_to_string(file_path) else {
                continue;
            };
            for (line_num, line) in content.lines().enumerate() {
                if !regex.is_match(line) {
                    continue;
                }
                matches.push(MgrepMatch {
                    pattern: pattern.clone(),
                    file: file_path.display().to_string(),
                    line: line_num + 1,
                    content: line.to_string(),
                });
                if matches.len() >= limit {
                    break;
                }
            }
        }
        matches
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
        let result = tool
            .search(&["const".to_string(), "let".to_string()], dir.path())
            .unwrap();

        assert!(result.results.contains_key("const"));
        assert!(result.results.contains_key("let"));
        assert_eq!(result.results["const"].len(), 2);
        assert_eq!(result.results["let"].len(), 1);
    }

    #[test]
    fn exclusions_ignore_directories_above_the_search_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("dist").join(".work").join("project");
        fs::create_dir_all(root.join("target")).unwrap();
        fs::write(root.join("a.txt"), "needle\n").unwrap();
        fs::write(root.join("target").join("b.txt"), "needle\n").unwrap();

        let result = MgrepTool::default()
            .search(&["needle".to_string()], &root)
            .unwrap();

        assert_eq!(result.results["needle"].len(), 1);
    }
}
