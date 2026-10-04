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
use walkdir::{DirEntry, WalkDir};

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
    /// Matches of every pattern that compiled
    pub results: HashMap<String, Vec<MgrepMatch>>,
    /// Patterns that are not valid regexes and were not searched
    pub invalid_patterns: Vec<InvalidPattern>,
    /// The shared deadline stopped traversal or at least one pattern early
    pub timed_out: bool,
}

/// A pattern that failed to compile
#[derive(Debug, Clone)]
pub struct InvalidPattern {
    pub pattern: String,
    pub error: String,
}

/// Matches of one pattern and whether the deadline cut it short.
struct PatternSearch {
    matches: Vec<MgrepMatch>,
    timed_out: bool,
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
        let (regexes, invalid_patterns) = compile_patterns(patterns);
        let (files, collection_timed_out) = self.collect_files(directory, start);

        // Search in parallel
        let searches: Vec<(String, PatternSearch)> = regexes
            .par_iter()
            .map(|compiled| {
                let search = self.search_pattern(compiled, &files, start);
                (compiled.0.clone(), search)
            })
            .collect();

        let timed_out = collection_timed_out || searches.iter().any(|(_, search)| search.timed_out);
        let results = searches
            .into_iter()
            .map(|(pattern, search)| (pattern, search.matches))
            .collect();
        Ok(MgrepResult {
            results,
            invalid_patterns,
            timed_out,
        })
    }

    /// Every included regular file whose size is known and within the limit.
    fn collect_files(&self, directory: &Path, start: Instant) -> (Vec<PathBuf>, bool) {
        let filter = PathFilter::new(directory, &self.config.exclude_patterns)
            .include_hidden(self.config.include_hidden);
        let mut walker = WalkDir::new(directory).follow_links(false).into_iter();
        let mut files = Vec::new();
        loop {
            if start.elapsed() >= self.config.timeout {
                return (files, true);
            }
            let Some(entry) = walker.next() else {
                return (files, false);
            };
            let Ok(entry) = entry else { continue };
            if !filter.allows(entry.path(), entry.file_type().is_dir()) {
                if entry.file_type().is_dir() {
                    walker.skip_current_dir();
                }
                continue;
            }
            if self.is_searchable(&entry) {
                files.push(entry.path().to_path_buf());
            }
        }
    }

    fn is_searchable(&self, entry: &DirEntry) -> bool {
        entry.file_type().is_file()
            && entry
                .metadata()
                .is_ok_and(|m| m.len() <= self.config.max_file_size)
    }

    /// Matching lines of one pattern, bounded by the shared deadline and the
    /// per-pattern result limit.
    fn search_pattern(
        &self,
        (pattern, regex): &(String, Regex),
        files: &[PathBuf],
        start: Instant,
    ) -> PatternSearch {
        let limit = self.config.max_results_per_pattern;
        let mut matches = Vec::new();
        for file_path in files {
            if start.elapsed() > self.config.timeout {
                return PatternSearch {
                    matches,
                    timed_out: true,
                };
            }
            if matches.len() >= limit {
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
        PatternSearch {
            matches,
            timed_out: false,
        }
    }
}

/// Split `patterns` into compiled regexes and the ones that do not compile.
fn compile_patterns(patterns: &[String]) -> (Vec<(String, Regex)>, Vec<InvalidPattern>) {
    let mut regexes = Vec::new();
    let mut invalid = Vec::new();
    for pattern in patterns {
        match Regex::new(pattern) {
            Ok(regex) => regexes.push((pattern.clone(), regex)),
            Err(err) => invalid.push(InvalidPattern {
                pattern: pattern.clone(),
                error: err.to_string(),
            }),
        }
    }
    (regexes, invalid)
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
    fn an_expired_deadline_stops_file_collection() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("match.txt"), "needle\n").unwrap();
        let tool = MgrepTool::new(MgrepConfig {
            timeout: Duration::ZERO,
            ..MgrepConfig::default()
        });

        let (files, timed_out) = tool.collect_files(dir.path(), Instant::now());
        assert!(files.is_empty());
        assert!(timed_out);
    }

    #[test]
    fn an_expired_deadline_is_reported_before_searching_any_files() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join("nested/empty")).unwrap();
        let tool = MgrepTool::new(MgrepConfig {
            timeout: Duration::ZERO,
            ..MgrepConfig::default()
        });

        let result = tool.search(&["needle".to_string()], dir.path()).unwrap();

        assert!(result.timed_out);
        assert!(result.results["needle"].is_empty());
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
