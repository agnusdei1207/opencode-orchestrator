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

/// Enhanced grep tool with timeout and resource limits
pub struct GrepTool {
    config: GrepConfig,
}

impl GrepTool {
    pub fn new(config: GrepConfig) -> Self {
        Self { config }
    }

    /// Search for a pattern in files
    pub fn search(&self, pattern: &str, directory: &Path) -> Result<Vec<GrepMatch>> {
        let start = Instant::now();
        let regex = Regex::new(pattern)?;
        let mut results = Vec::new();

        let filter = PathFilter::new(directory, &self.config.exclude_patterns)
            .include_hidden(self.config.include_hidden)
            .include_only(&self.config.include_patterns);
        let walker = WalkDir::new(directory)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| filter.allows(e.path()));

        for entry in walker {
            if start.elapsed() > self.config.timeout || results.len() >= self.config.max_results {
                break;
            }
            let Ok(entry) = entry else { continue };
            if self.is_searchable(&entry) {
                self.search_file(&regex, entry.path(), &mut results);
            }
        }

        Ok(results)
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
        let results = tool.search("hello", dir.path()).unwrap();

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

        let results = GrepTool::default().search("needle", &root).unwrap();

        assert_eq!(results.len(), 1, "{results:?}");
        assert!(results[0].file.ends_with("a.txt"));
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

        assert_eq!(unbounded.len(), 20);
        assert!(expired.is_empty(), "an expired deadline must stop the walk");
    }
}
