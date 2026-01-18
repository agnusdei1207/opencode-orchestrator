//! Sed-like find and replace tool with timeout protection

use crate::Result;
use regex::Regex;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Configuration for sed operations
#[derive(Debug, Clone)]
pub struct SedConfig {
    /// Maximum time to spend on operation
    pub timeout: Duration,
    /// Maximum file size to process (bytes)
    pub max_file_size: u64,
    /// Create backup before modifying
    pub backup: bool,
    /// Dry run (don't actually modify files)
    pub dry_run: bool,
    /// File patterns to include
    pub include_patterns: Vec<String>,
    /// File patterns to exclude
    pub exclude_patterns: Vec<String>,
}

impl Default for SedConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(60),
            max_file_size: 10 * 1024 * 1024, // 10MB
            backup: false,
            dry_run: false,
            include_patterns: vec![],
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/.git/**".to_string(),
                "**/target/**".to_string(),
                "**/dist/**".to_string(),
            ],
        }
    }
}

/// Result of a sed replacement operation
#[derive(Debug, Clone)]
pub struct SedResult {
    pub file: String,
    pub replacements: usize,
    pub original_lines: Vec<String>,
    pub modified_lines: Vec<String>,
}

/// Sed-like find and replace tool
pub struct SedTool {
    config: SedConfig,
}

impl SedTool {
    pub fn new(config: SedConfig) -> Self {
        Self { config }
    }

    /// Replace pattern in a single file
    pub fn replace_in_file(
        &self,
        pattern: &str,
        replacement: &str,
        file_path: &Path,
    ) -> Result<Option<SedResult>> {
        // Check file size
        if let Ok(metadata) = fs::metadata(file_path) {
            if metadata.len() > self.config.max_file_size {
                return Ok(None);
            }
        }

        let content = fs::read_to_string(file_path)?;
        let regex = Regex::new(pattern)?;
        
        let mut replacements = 0;
        let original_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        let mut modified_lines = Vec::new();

        for line in content.lines() {
            if regex.is_match(line) {
                let new_line = regex.replace_all(line, replacement).to_string();
                if new_line != line {
                    replacements += 1;
                }
                modified_lines.push(new_line);
            } else {
                modified_lines.push(line.to_string());
            }
        }

        if replacements == 0 {
            return Ok(None);
        }

        // Write changes if not dry run
        if !self.config.dry_run {
            // Create backup if requested
            if self.config.backup {
                let backup_path = format!("{}.bak", file_path.display());
                fs::write(&backup_path, &content)?;
            }

            let new_content = modified_lines.join("\n");
            // Preserve trailing newline if original had one
            let new_content = if content.ends_with('\n') {
                format!("{}\n", new_content)
            } else {
                new_content
            };
            fs::write(file_path, new_content)?;
        }

        Ok(Some(SedResult {
            file: file_path.display().to_string(),
            replacements,
            original_lines,
            modified_lines,
        }))
    }

    /// Replace pattern in multiple files in a directory
    pub fn replace_in_directory(
        &self,
        pattern: &str,
        replacement: &str,
        directory: &Path,
    ) -> Result<Vec<SedResult>> {
        let start = Instant::now();
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

            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            if let Ok(Some(result)) = self.replace_in_file(pattern, replacement, entry.path()) {
                results.push(result);
            }
        }

        Ok(results)
    }

    /// Check if a path should be included
    fn should_include(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();

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

impl Default for SedTool {
    fn default() -> Self {
        Self::new(SedConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_sed_basic() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "hello world\nfoo bar\nhello again").unwrap();

        let tool = SedTool::new(SedConfig {
            exclude_patterns: vec![],
            ..Default::default()
        });
        
        let result = tool.replace_in_file("hello", "hi", &file).unwrap();
        assert!(result.is_some());
        
        let result = result.unwrap();
        assert_eq!(result.replacements, 2);

        let content = fs::read_to_string(&file).unwrap();
        assert!(content.contains("hi world"));
        assert!(content.contains("hi again"));
    }

    #[test]
    fn test_sed_dry_run() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "hello world").unwrap();

        let tool = SedTool::new(SedConfig {
            dry_run: true,
            exclude_patterns: vec![],
            ..Default::default()
        });
        
        let result = tool.replace_in_file("hello", "hi", &file).unwrap();
        assert!(result.is_some());

        // File should not be modified
        let content = fs::read_to_string(&file).unwrap();
        assert_eq!(content, "hello world");
    }

    #[test]
    fn test_sed_regex() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.rs");
        fs::write(&file, "Color::rgb(1.0, 0.0, 0.0)\nColor::rgb(0.5, 0.5, 0.5)").unwrap();

        let tool = SedTool::new(SedConfig {
            exclude_patterns: vec![],
            ..Default::default()
        });
        
        let result = tool.replace_in_file(r"Color::rgb", "Color::srgb", &file).unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().replacements, 2);

        let content = fs::read_to_string(&file).unwrap();
        assert!(content.contains("Color::srgb"));
        assert!(!content.contains("Color::rgb"));
    }
}
