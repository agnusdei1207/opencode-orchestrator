//! Enhanced grep tool with timeout protection

use crate::Result;
use regex::Regex;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

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
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/.git/**".to_string(),
                "**/target/**".to_string(),
                "**/dist/**".to_string(),
                "**/build/**".to_string(),
            ],
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

        let walker = WalkDir::new(directory)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| self.should_include(e.path()));

        for entry in walker {
            // Check timeout
            if start.elapsed() > self.config.timeout {
                break;
            }

            // Check result limit
            if results.len() >= self.config.max_results {
                break;
            }

            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            // Check file size
            if let Ok(metadata) = entry.metadata() {
                if metadata.len() > self.config.max_file_size {
                    continue;
                }
            }

            // Search file
            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                for (line_num, line) in content.lines().enumerate() {
                    if let Some(m) = regex.find(line) {
                        results.push(GrepMatch {
                            file: entry.path().display().to_string(),
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
        }

        Ok(results)
    }

    /// Check if a path should be included in search
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

        // Check include patterns (if specified)
        if !self.config.include_patterns.is_empty() {
            return self.config.include_patterns.iter().any(|pattern| {
                glob::Pattern::new(pattern)
                    .map(|p| p.matches(&path_str))
                    .unwrap_or(false)
            });
        }

        true
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
    fn test_grep_timeout() {
        let tool = GrepTool::new(GrepConfig {
            timeout: Duration::from_millis(1),
            ..Default::default()
        });

        // This should complete quickly due to timeout
        let _ = tool.search("test", Path::new("/"));
    }
}
