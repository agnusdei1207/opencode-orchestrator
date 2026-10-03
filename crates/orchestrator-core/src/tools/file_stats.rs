//! File statistics tool

use crate::Result;
use crate::tools::path_filter::{PathFilter, heavy_directory_excludes};
use std::cmp::Reverse;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::{DirEntry, WalkDir};

/// Largest file whose lines are counted. Bigger files still count toward
/// the file, size and file type totals.
pub const MAX_LINE_COUNT_BYTES: u64 = 4 * 1024 * 1024;
/// Number of entries in `DirStats::largest_files`.
const LARGEST_FILES_SHOWN: usize = 10;
/// File type key of files without an extension.
const NO_EXTENSION: &str = "no_extension";

/// File type statistics. Every file is counted; `total_lines` covers only
/// the UTF-8 files within [`MAX_LINE_COUNT_BYTES`].
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
    /// The walk stopped at `FileStatsConfig::timeout`; totals are partial.
    pub timed_out: bool,
}

/// Configuration for file statistics
#[derive(Debug, Clone)]
pub struct FileStatsConfig {
    /// Maximum time to spend walking the tree
    pub timeout: Duration,
    /// Trees that are skipped entirely, relative to the analyzed directory
    pub exclude_patterns: Vec<String>,
}

impl Default for FileStatsConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            exclude_patterns: heavy_directory_excludes(),
        }
    }
}

/// File statistics tool
pub struct FileStatsTool {
    config: FileStatsConfig,
}

impl FileStatsTool {
    pub fn new(config: FileStatsConfig) -> Self {
        Self { config }
    }

    /// Get statistics for a directory. Hidden files are counted; the
    /// configured heavy trees are not walked.
    pub fn analyze(&self, directory: &Path, max_depth: Option<usize>) -> Result<DirStats> {
        let start = Instant::now();
        let mut walker = WalkDir::new(directory);
        if let Some(depth) = max_depth {
            walker = walker.max_depth(depth);
        }
        let filter = PathFilter::new(directory, &self.config.exclude_patterns).include_hidden(true);

        let mut totals = StatsAccumulator::default();
        let entries = walker.into_iter().filter_entry(|e| filter.allows(e.path()));
        for entry in entries.filter_map(|e| e.ok()) {
            if start.elapsed() >= self.config.timeout {
                totals.timed_out = true;
                break;
            }
            totals.record(&entry);
        }
        Ok(totals.finish())
    }
}

impl Default for FileStatsTool {
    fn default() -> Self {
        Self::new(FileStatsConfig::default())
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
    timed_out: bool,
}

impl StatsAccumulator {
    fn record(&mut self, entry: &DirEntry) {
        let path = entry.path();
        if path.is_dir() {
            self.total_dirs += 1;
            return;
        }
        self.total_files += 1;

        let size = entry.metadata().ok().map(|metadata| metadata.len());
        if let Some(size) = size {
            self.total_size += size;
            self.files_with_sizes
                .push((path.display().to_string(), size));
        }
        let lines = size
            .filter(|size| *size <= MAX_LINE_COUNT_BYTES)
            .and_then(|_| count_text_lines(path))
            .unwrap_or(0);
        self.total_lines += lines;
        self.record_file_type(path, size.unwrap_or(0), lines);
    }

    fn record_file_type(&mut self, path: &Path, size: u64, lines: usize) {
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_else(|| NO_EXTENSION.to_string());

        let stats = self.file_types.entry(ext.clone()).or_insert(FileTypeStats {
            extension: ext,
            ..FileTypeStats::default()
        });
        stats.count += 1;
        stats.total_lines += lines;
        stats.total_size += size;
    }

    /// Largest files first and file types ordered by count.
    fn finish(mut self) -> DirStats {
        self.files_with_sizes.sort_by_key(|entry| Reverse(entry.1));
        let largest_files: Vec<(String, u64)> = self
            .files_with_sizes
            .into_iter()
            .take(LARGEST_FILES_SHOWN)
            .collect();

        let mut file_types: Vec<FileTypeStats> = self.file_types.into_values().collect();
        file_types.sort_by_key(|stats| Reverse(stats.count));

        DirStats {
            total_files: self.total_files,
            total_dirs: self.total_dirs,
            total_size: self.total_size,
            total_lines: self.total_lines,
            file_types,
            largest_files,
            timed_out: self.timed_out,
        }
    }
}

/// Line count of a UTF-8 file, reading at most [`MAX_LINE_COUNT_BYTES`] even
/// if the file grew after its size was checked. `None` for binary files.
fn count_text_lines(path: &Path) -> Option<usize> {
    let mut bytes = Vec::new();
    File::open(path)
        .ok()?
        .take(MAX_LINE_COUNT_BYTES + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() as u64 > MAX_LINE_COUNT_BYTES {
        return None;
    }
    std::str::from_utf8(&bytes)
        .ok()
        .map(|text| text.lines().count())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_dir_analyze() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.ts"), "const a = 1;").unwrap();
        fs::write(dir.path().join("b.ts"), "const b = 2;").unwrap();

        let tool = FileStatsTool::default();
        let stats = tool.analyze(dir.path(), None).unwrap();

        assert_eq!(stats.total_files, 2);
        assert!(stats.file_types.iter().any(|t| t.extension == "ts"));
    }

    #[test]
    fn heavy_directories_are_not_walked() {
        let dir = tempdir().unwrap();
        for heavy in ["node_modules", ".git", "target"] {
            fs::create_dir(dir.path().join(heavy)).unwrap();
            fs::write(dir.path().join(heavy).join("x.js"), "x\n").unwrap();
        }
        fs::write(dir.path().join("a.ts"), "a\n").unwrap();

        let stats = FileStatsTool::default().analyze(dir.path(), None).unwrap();

        assert_eq!(stats.total_files, 1);
        assert_eq!(stats.total_dirs, 1, "only the root directory is counted");
    }

    #[test]
    fn binary_files_count_in_file_types_but_not_lines() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "one\ntwo\n").unwrap();
        fs::write(dir.path().join("b.bin"), [0xff, 0xfe, b'\n']).unwrap();

        let stats = FileStatsTool::default().analyze(dir.path(), None).unwrap();

        let typed: usize = stats.file_types.iter().map(|t| t.count).sum();
        assert_eq!(stats.total_files, 2);
        assert_eq!(typed, stats.total_files);
        assert_eq!(stats.total_lines, 2);
    }

    #[test]
    fn files_above_the_read_cap_are_counted_without_reading_lines() {
        let dir = tempdir().unwrap();
        let big = dir.path().join("big.txt");
        fs::File::create(&big)
            .unwrap()
            .set_len(MAX_LINE_COUNT_BYTES + 1)
            .unwrap();

        let stats = FileStatsTool::default().analyze(dir.path(), None).unwrap();

        assert_eq!(stats.total_files, 1);
        assert_eq!(stats.total_lines, 0);
        assert_eq!(stats.total_size, MAX_LINE_COUNT_BYTES + 1);
    }

    #[test]
    fn an_expired_deadline_stops_the_walk_and_is_reported() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "a\n").unwrap();
        let tool = FileStatsTool::new(FileStatsConfig {
            timeout: Duration::ZERO,
            ..FileStatsConfig::default()
        });

        let stats = tool.analyze(dir.path(), None).unwrap();

        assert!(stats.timed_out);
        assert_eq!(stats.total_files, 0);
    }
}
