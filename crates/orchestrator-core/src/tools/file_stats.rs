//! File statistics tool

use crate::Result;
use std::path::Path;
use walkdir::WalkDir;

/// File type statistics
#[derive(Debug, Clone, Default)]
pub struct FileTypeStats {
    pub extension: String,
    pub count: usize,
    pub total_size: u64,
    pub total_lines: usize,
}

/// Directory statistics
#[derive(Debug, Clone)]
pub struct DirStats {
    pub total_files: usize,
    pub total_dirs: usize,
    pub total_size: u64,
    pub total_lines: usize,
    pub file_types: Vec<FileTypeStats>,
    pub largest_files: Vec<(String, u64)>,
}

/// File statistics tool
pub struct FileStatsTool;

impl FileStatsTool {
    pub fn new() -> Self {
        Self
    }

    /// Get statistics for a directory
    pub fn analyze(&self, directory: &Path, max_depth: Option<usize>) -> Result<DirStats> {
        let mut total_files = 0;
        let mut total_dirs = 0;
        let mut total_size = 0u64;
        let mut total_lines = 0;
        let mut file_types: std::collections::HashMap<String, FileTypeStats> = std::collections::HashMap::new();
        let mut files_with_sizes: Vec<(String, u64)> = Vec::new();

        let walker = if let Some(depth) = max_depth {
            WalkDir::new(directory).max_depth(depth)
        } else {
            WalkDir::new(directory)
        };

        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            
            if path.is_dir() {
                total_dirs += 1;
                continue;
            }

            total_files += 1;

            // File size
            if let Ok(metadata) = entry.metadata() {
                let size = metadata.len();
                total_size += size;
                files_with_sizes.push((path.display().to_string(), size));
            }

            // Line count (for text files only)
            if let Ok(content) = std::fs::read_to_string(path) {
                let lines = content.lines().count();
                total_lines += lines;

                // File type stats
                let ext = path
                    .extension()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_else(|| "no_extension".to_string());

                let stats = file_types.entry(ext.clone()).or_insert(FileTypeStats {
                    extension: ext,
                    count: 0,
                    total_size: 0,
                    total_lines: 0,
                });
                stats.count += 1;
                stats.total_lines += lines;
                if let Ok(metadata) = entry.metadata() {
                    stats.total_size += metadata.len();
                }
            }
        }

        // Sort files by size and get top 10
        files_with_sizes.sort_by(|a, b| b.1.cmp(&a.1));
        let largest_files: Vec<(String, u64)> = files_with_sizes.into_iter().take(10).collect();

        // Convert file_types to sorted vec
        let mut file_types_vec: Vec<FileTypeStats> = file_types.into_values().collect();
        file_types_vec.sort_by(|a, b| b.count.cmp(&a.count));

        Ok(DirStats {
            total_files,
            total_dirs,
            total_size,
            total_lines,
            file_types: file_types_vec,
            largest_files,
        })
    }

    /// Get statistics for a single file
    pub fn file_info(&self, file_path: &Path) -> Result<(u64, usize)> {
        let metadata = std::fs::metadata(file_path)?;
        let size = metadata.len();
        
        let lines = std::fs::read_to_string(file_path)
            .map(|c| c.lines().count())
            .unwrap_or(0);
        
        Ok((size, lines))
    }
}

impl Default for FileStatsTool {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_file_info() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "line1\nline2\nline3").unwrap();
        
        let tool = FileStatsTool::new();
        let (size, lines) = tool.file_info(&file).unwrap();
        
        assert_eq!(size, 17);
        assert_eq!(lines, 3);
    }

    #[test]
    fn test_dir_analyze() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.ts"), "const a = 1;").unwrap();
        fs::write(dir.path().join("b.ts"), "const b = 2;").unwrap();
        
        let tool = FileStatsTool::new();
        let stats = tool.analyze(dir.path(), None).unwrap();
        
        assert_eq!(stats.total_files, 2);
        assert!(stats.file_types.iter().any(|t| t.extension == "ts"));
    }
}
