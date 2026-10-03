//! File statistics tool

use crate::Result;
use std::cmp::Reverse;
use std::collections::HashMap;
use std::path::Path;
use walkdir::{DirEntry, WalkDir};

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
        let walker = if let Some(depth) = max_depth {
            WalkDir::new(directory).max_depth(depth)
        } else {
            WalkDir::new(directory)
        };

        let mut totals = StatsAccumulator::default();
        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            totals.record(&entry);
        }
        Ok(totals.finish())
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

/// Running totals of one directory walk.
#[derive(Default)]
struct StatsAccumulator {
    total_files: usize,
    total_dirs: usize,
    total_size: u64,
    total_lines: usize,
    file_types: HashMap<String, FileTypeStats>,
    files_with_sizes: Vec<(String, u64)>,
}

impl StatsAccumulator {
    fn record(&mut self, entry: &DirEntry) {
        let path = entry.path();
        if path.is_dir() {
            self.total_dirs += 1;
            return;
        }
        self.total_files += 1;

        if let Ok(metadata) = entry.metadata() {
            let size = metadata.len();
            self.total_size += size;
            self.files_with_sizes
                .push((path.display().to_string(), size));
        }

        // Only text files contribute line counts and file type stats.
        if let Ok(content) = std::fs::read_to_string(path) {
            self.record_text_file(entry, content.lines().count());
        }
    }

    fn record_text_file(&mut self, entry: &DirEntry, lines: usize) {
        self.total_lines += lines;
        let ext = entry
            .path()
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_else(|| "no_extension".to_string());

        let stats = self.file_types.entry(ext.clone()).or_insert(FileTypeStats {
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

    /// Top 10 files by size and file types ordered by count.
    fn finish(mut self) -> DirStats {
        self.files_with_sizes.sort_by_key(|entry| Reverse(entry.1));
        let largest_files: Vec<(String, u64)> =
            self.files_with_sizes.into_iter().take(10).collect();

        let mut file_types: Vec<FileTypeStats> = self.file_types.into_values().collect();
        file_types.sort_by_key(|stats| Reverse(stats.count));

        DirStats {
            total_files: self.total_files,
            total_dirs: self.total_dirs,
            total_size: self.total_size,
            total_lines: self.total_lines,
            file_types,
            largest_files,
        }
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
