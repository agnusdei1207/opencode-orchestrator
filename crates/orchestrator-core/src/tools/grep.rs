//! Enhanced grep tool with timeout protection

use crate::Result;
use crate::tools::path_filter::{PathFilter, heavy_directory_excludes};
use regex::Regex;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::{DirEntry, WalkDir};

/// Configuration for grep operations
#[derive(Debug, Clone)]
pub struct GrepConfig {
    /// Maximum time to spend on search
    pub timeout: Duration,
    /// Maximum number of results
    pub max_results: usize,
    /// Maximum file size to search (bytes)
    pub max_file_size: u64,
    /// Include hidden files
    pub include_hidden: bool,
    /// File patterns to include
    pub include_patterns: Vec<String>,
    /// File patterns to exclude
    pub exclude_patterns: Vec<String>,
}

impl Default for GrepConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            max_results: 1000,
            max_file_size: 10 * 1024 * 1024, // 10MB
            include_hidden: false,
            include_patterns: vec![],
            exclude_patterns: heavy_directory_excludes(),
        }
    }
}

/// A single grep match
#[derive(Debug, Clone)]
pub struct GrepMatch {
    pub file: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// Matches of one search, at most `GrepConfig::max_results`
#[derive(Debug, Clone, Default)]
pub struct GrepSearch {
    pub matches: Vec<GrepMatch>,
    /// The walk stopped at `GrepConfig::timeout`; more files may match
    pub timed_out: bool,
}

/// Enhanced grep tool with timeout and resource limits
pub struct GrepTool {
    config: GrepConfig,
}

impl GrepTool {
    pub fn new(config: GrepConfig) -> Self {
        Self { config }
    }

    /// Search for a pattern in files
    pub fn search(&self, pattern: &str, directory: &Path) -> Result<GrepSearch> {
        let start = Instant::now();
        let regex = Regex::new(pattern)?;
        let mut found = GrepSearch::default();

        let filter = PathFilter::new(directory, &self.config.exclude_patterns)
            .include_hidden(self.config.include_hidden)
            .include_only(&self.config.include_patterns);
        let walker = WalkDir::new(directory)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| filter.allows(e.path(), e.file_type().is_dir()));

        for entry in walker {
            if start.elapsed() > self.config.timeout {
                found.timed_out = true;
                break;
            }
            if found.matches.len() >= self.config.max_results {
                break;
            }
            let Ok(entry) = entry else { continue };
            if self.is_searchable(&entry) {
                self.search_file(&regex, entry.path(), &mut found.matches);
            }
        }

        Ok(found)
    }

    /// Regular files only; a file whose size cannot be read is still searched.
    fn is_searchable(&self, entry: &DirEntry) -> bool {
        entry.file_type().is_file()
            && !entry
                .metadata()
                .is_ok_and(|metadata| metadata.len() > self.config.max_file_size)
    }

    /// Append the first match of each line of a readable text file, stopping
    /// at `max_results`.
    fn search_file(&self, regex: &Regex, path: &Path, results: &mut Vec<GrepMatch>) {
        let Ok(content) = std::fs::read_to_string(path) else {
            return;
        };
        for (line_num, line) in content.lines().enumerate() {
            let Some(m) = regex.find(line) else { continue };
            results.push(GrepMatch {
                file: path.display().to_string(),
                line_number: line_num + 1,
                line_content: line.to_string(),
                match_start: m.start(),
                match_end: m.end(),
            });
            if results.len() >= self.config.max_results {
                break;
            }
        }
    }
}

impl Default for GrepTool {
    fn default() -> Self {
        Self::new(GrepConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_grep_basic() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "hello world\nfoo bar\nhello again").unwrap();

        let tool = GrepTool::new(GrepConfig {
            include_hidden: true,
            exclude_patterns: vec![],
            ..Default::default()
        });
        let results = tool.search("hello", dir.path()).unwrap().matches;

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].line_number, 1);
        assert_eq!(results[1].line_number, 3);
    }

    #[test]
    fn exclusions_ignore_directories_above_the_search_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("build").join("project");
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join(".cache")).unwrap();
        fs::write(root.join("a.txt"), "needle\n").unwrap();
        fs::write(root.join("node_modules").join("b.txt"), "needle\n").unwrap();
        fs::write(root.join(".cache").join("c.txt"), "needle\n").unwrap();

        let results = GrepTool::default().search("needle", &root).unwrap().matches;

        assert_eq!(results.len(), 1, "{results:?}");
        assert!(results[0].file.ends_with("a.txt"));
    }

    #[test]
    fn regular_files_named_like_excluded_directories_are_searched() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join("scripts")).unwrap();
        fs::create_dir_all(dir.path().join("build")).unwrap();
        fs::write(dir.path().join("scripts").join("build"), "needle\n").unwrap();
        fs::write(dir.path().join("build").join("out.txt"), "needle\n").unwrap();

        let results = GrepTool::default()
            .search("needle", dir.path())
            .unwrap()
            .matches;

        assert_eq!(results.len(), 1, "{results:?}");
        assert!(
            Path::new(&results[0].file).ends_with("scripts/build"),
            "{results:?}"
        );
    }

    #[test]
    fn include_patterns_find_nested_files_without_admitting_excluded_trees() {
        let dir = tempdir().unwrap();
        for name in [
            "src/nested/lib.rs",
            "src/readme.txt",
            "target/cache.rs",
            ".cache/lib.rs",
        ] {
            let file = dir.path().join(name);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, "needle\n").unwrap();
        }
        let tool = GrepTool::new(GrepConfig {
            include_patterns: vec!["**/*.rs".to_string()],
            ..GrepConfig::default()
        });

        let result = tool.search("needle", dir.path()).unwrap();

        assert_eq!(result.matches.len(), 1);
        assert!(Path::new(&result.matches[0].file).ends_with("src/nested/lib.rs"));
        assert!(!result.timed_out);
    }

    #[test]
    fn test_grep_timeout() {
        let dir = tempdir().unwrap();
        for index in 0..20 {
            fs::write(dir.path().join(format!("file{index}.txt")), "needle\n").unwrap();
        }
        let config = GrepConfig {
            include_hidden: true,
            exclude_patterns: vec![],
            ..Default::default()
        };

        let unbounded = GrepTool::new(config.clone())
            .search("needle", dir.path())
            .unwrap();
        let expired = GrepTool::new(GrepConfig {
            timeout: Duration::ZERO,
            ..config
        })
        .search("needle", dir.path())
        .unwrap();

        assert_eq!(unbounded.matches.len(), 20);
        assert!(!unbounded.timed_out);
        assert!(
            expired.matches.is_empty(),
            "an expired deadline must stop the walk"
        );
        assert!(expired.timed_out);
    }
}
