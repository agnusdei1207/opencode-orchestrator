//! Enhanced glob tool with timeout protection

use crate::Result;
use crate::tools::path_filter::PathFilter;
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
    pub fn find(&self, pattern: &str, directory: &Path) -> Result<GlobSearch> {
        let start = Instant::now();
        let mut found = GlobSearch::default();

        let glob_pattern = glob::Pattern::new(pattern)
            .map_err(|e| crate::Error::Tool(format!("Invalid glob pattern: {}", e)))?;

        let mut walker = WalkDir::new(directory).follow_links(false);

        if let Some(max_depth) = self.config.max_depth {
            walker = walker.max_depth(max_depth);
        }

        let filter = PathFilter::new(directory, &self.config.exclude_patterns)
            .include_hidden(self.config.include_hidden);
        for entry in walker.into_iter().filter_entry(|e| filter.allows(e.path())) {
            if start.elapsed() > self.config.timeout {
                found.timed_out = true;
                break;
            }
            if found.paths.len() >= self.config.max_results {
                break;
            }
            let Ok(entry) = entry else { continue };

            let path = entry.path();
            let relative = path.strip_prefix(directory).unwrap_or(path);
            if glob_pattern.matches_path(relative) {
                found.paths.push(path.to_path_buf());
            }
        }

        Ok(found)
    }
}

/// Paths found by one search, at most `GlobConfig::max_results`
#[derive(Debug, Clone, Default)]
pub struct GlobSearch {
    pub paths: Vec<PathBuf>,
    /// The walk stopped at `GlobConfig::timeout`; more paths may match
    pub timed_out: bool,
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
        let results = tool.find("*.rs", dir.path()).unwrap().paths;

        assert_eq!(results.len(), 1);
        assert!(results[0].to_string_lossy().contains("test.rs"));
    }

    #[test]
    fn exclusions_ignore_directories_above_the_search_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("target").join("project");
        fs::create_dir_all(root.join("target")).unwrap();
        fs::write(root.join("a.rs"), "").unwrap();
        fs::write(root.join("target").join("b.rs"), "").unwrap();

        let results = GlobTool::default().find("**/*.rs", &root).unwrap().paths;

        assert_eq!(results, vec![root.join("a.rs")]);
    }

    #[test]
    fn a_hidden_search_root_is_still_searched() {
        let dir = tempdir().unwrap();
        let root = dir.path().join(".config");
        fs::create_dir_all(root.join(".secret")).unwrap();
        fs::write(root.join("a.rs"), "").unwrap();
        fs::write(root.join(".secret").join("b.rs"), "").unwrap();

        let results = GlobTool::default().find("**/*.rs", &root).unwrap().paths;

        assert_eq!(results, vec![root.join("a.rs")]);
    }

    #[test]
    fn double_star_patterns_find_nested_files() {
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
        let results = tool.find("**/*.ts", dir.path()).unwrap().paths;

        assert_eq!(results.len(), 2);
    }
}
