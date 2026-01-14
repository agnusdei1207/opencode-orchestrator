//! Enhanced glob tool with timeout protection

use crate::Result;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Configuration for glob operations
#[derive(Debug, Clone)]
pub struct GlobConfig {
    /// Maximum time to spend on search
    pub timeout: Duration,
    /// Maximum number of results
    pub max_results: usize,
    /// Maximum depth to traverse
    pub max_depth: Option<usize>,
    /// Include hidden files
    pub include_hidden: bool,
    /// Patterns to exclude
    pub exclude_patterns: Vec<String>,
}

impl Default for GlobConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            max_results: 5000,
            max_depth: None,
            include_hidden: false,
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/.git/**".to_string(),
                "**/target/**".to_string(),
            ],
        }
    }
}

/// Enhanced glob tool with timeout and resource limits
pub struct GlobTool {
    config: GlobConfig,
}

impl GlobTool {
    pub fn new(config: GlobConfig) -> Self {
        Self { config }
    }

    /// Find files matching a glob pattern
    pub fn find(&self, pattern: &str, directory: &Path) -> Result<Vec<PathBuf>> {
        let start = Instant::now();
        let mut results = Vec::new();

        let glob_pattern = glob::Pattern::new(pattern)
            .map_err(|e| crate::Error::Tool(format!("Invalid glob pattern: {}", e)))?;

        let mut walker = WalkDir::new(directory).follow_links(false);

        if let Some(max_depth) = self.config.max_depth {
            walker = walker.max_depth(max_depth);
        }

        for entry in walker.into_iter().filter_entry(|e| self.should_include(e.path())) {
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

            let path = entry.path();
            let relative = path.strip_prefix(directory).unwrap_or(path);

            if glob_pattern.matches_path(relative) {
                results.push(path.to_path_buf());
            }
        }

        Ok(results)
    }

    /// Find files by extension
    pub fn find_by_extension(&self, extension: &str, directory: &Path) -> Result<Vec<PathBuf>> {
        let pattern = format!("**/*.{}", extension);
        self.find(&pattern, directory)
    }

    /// Find directories matching a pattern
    pub fn find_dirs(&self, pattern: &str, directory: &Path) -> Result<Vec<PathBuf>> {
        let start = Instant::now();
        let mut results = Vec::new();

        let glob_pattern = glob::Pattern::new(pattern)
            .map_err(|e| crate::Error::Tool(format!("Invalid glob pattern: {}", e)))?;

        let mut walker = WalkDir::new(directory).follow_links(false);

        if let Some(max_depth) = self.config.max_depth {
            walker = walker.max_depth(max_depth);
        }

        for entry in walker.into_iter().filter_entry(|e| self.should_include(e.path())) {
            if start.elapsed() > self.config.timeout {
                break;
            }

            if results.len() >= self.config.max_results {
                break;
            }

            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_dir() {
                continue;
            }

            let path = entry.path();
            let relative = path.strip_prefix(directory).unwrap_or(path);

            if glob_pattern.matches_path(relative) {
                results.push(path.to_path_buf());
            }
        }

        Ok(results)
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

impl Default for GlobTool {
    fn default() -> Self {
        Self::new(GlobConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_glob_basic() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("test.rs"), "").unwrap();
        fs::write(dir.path().join("test.ts"), "").unwrap();
        fs::write(dir.path().join("other.txt"), "").unwrap();

        let tool = GlobTool::new(GlobConfig {
            include_hidden: true,
            exclude_patterns: vec![],
            ..Default::default()
        });
        let results = tool.find("*.rs", dir.path()).unwrap();

        assert_eq!(results.len(), 1);
        assert!(results[0].to_string_lossy().contains("test.rs"));
    }

    #[test]
    fn test_find_by_extension() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(dir.path().join("a.ts"), "").unwrap();
        fs::write(sub.join("b.ts"), "").unwrap();
        fs::write(dir.path().join("c.js"), "").unwrap();

        let tool = GlobTool::new(GlobConfig {
            include_hidden: true,
            exclude_patterns: vec![],
            ..Default::default()
        });
        let results = tool.find_by_extension("ts", dir.path()).unwrap();

        assert_eq!(results.len(), 2);
    }
}
