//! Sed-like find and replace tool with timeout protection

use crate::tools::path_filter::PathFilter;
use crate::{Error, Result};
use regex::Regex;
use std::ffi::OsStr;
use std::fs;
use std::io::{self, Write};
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::{DirEntry, WalkDir};

/// Extension of the backups written when `SedConfig::backup` is set.
const BACKUP_EXTENSION: &str = "bak";

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
    /// Lines without their line endings
    pub original_lines: Vec<String>,
    /// Lines without their line endings
    pub modified_lines: Vec<String>,
}

/// A file or directory entry that directory mode could not process.
#[derive(Debug, Clone)]
pub struct SedFileError {
    pub file: String,
    pub error: String,
}

/// Outcome of a directory-wide replacement.
#[derive(Debug, Clone, Default)]
pub struct SedDirectoryReport {
    /// Files that were modified (or would be, in dry-run mode)
    pub results: Vec<SedResult>,
    /// Entries that failed; the other files were still processed
    pub errors: Vec<SedFileError>,
    /// The walk stopped at `SedConfig::timeout` before visiting every file
    pub timed_out: bool,
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
        let regex = Regex::new(pattern)?;
        self.replace_with_regex(&regex, replacement, file_path)
    }

    fn replace_with_regex(
        &self,
        regex: &Regex,
        replacement: &str,
        file_path: &Path,
    ) -> Result<Option<SedResult>> {
        // Check file size
        if let Ok(metadata) = fs::metadata(file_path)
            && metadata.len() > self.config.max_file_size
        {
            return Ok(None);
        }

        let content = fs::read_to_string(file_path)?;
        let rewrite = rewrite_lines(&content, regex, replacement);
        if rewrite.replacements == 0 {
            return Ok(None);
        }

        if !self.config.dry_run {
            if self.config.backup {
                let backup_path = format!("{}.{BACKUP_EXTENSION}", file_path.display());
                fs::write(&backup_path, &content)?;
            }
            write_atomically(file_path, &rewrite.content)?;
        }

        Ok(Some(SedResult {
            file: file_path.display().to_string(),
            replacements: rewrite.replacements,
            original_lines: rewrite.original_lines,
            modified_lines: rewrite.modified_lines,
        }))
    }

    /// Replace pattern in every text file below `directory`.
    ///
    /// An invalid pattern fails the whole call. Per-file failures are
    /// collected in the report instead of aborting the walk; binary
    /// (non-UTF-8) files and `.bak` backups are skipped.
    pub fn replace_in_directory(
        &self,
        pattern: &str,
        replacement: &str,
        directory: &Path,
    ) -> Result<SedDirectoryReport> {
        let regex = Regex::new(pattern)?;
        let substitution = Substitution {
            regex: &regex,
            replacement,
        };
        let start = Instant::now();
        let mut report = SedDirectoryReport::default();

        let filter = self.walk_filter(directory);
        let walker = WalkDir::new(directory)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| filter.allows(e.path(), e.file_type().is_dir()));

        for entry in walker {
            if start.elapsed() > self.config.timeout {
                report.timed_out = true;
                break;
            }
            match entry {
                Ok(entry) if is_replaceable_file(&entry) => {
                    self.record_file(substitution, entry.path(), &mut report);
                }
                Ok(_) => {}
                Err(err) => report.errors.push(SedFileError {
                    file: err
                        .path()
                        .map(|p| p.display().to_string())
                        .unwrap_or_default(),
                    error: err.to_string(),
                }),
            }
        }

        Ok(report)
    }

    fn record_file(
        &self,
        substitution: Substitution<'_>,
        path: &Path,
        report: &mut SedDirectoryReport,
    ) {
        match self.replace_with_regex(substitution.regex, substitution.replacement, path) {
            Ok(Some(result)) => report.results.push(result),
            Ok(None) => {}
            // Non-UTF-8 content is a binary file, not text this tool edits;
            // a file removed while the walk was running is simply gone.
            Err(Error::Io(err))
                if matches!(
                    err.kind(),
                    io::ErrorKind::InvalidData | io::ErrorKind::NotFound
                ) => {}
            Err(err) => report.errors.push(SedFileError {
                file: path.display().to_string(),
                error: err.to_string(),
            }),
        }
    }

    /// Directory mode has always rewritten hidden files too; only the
    /// configured globs, relative to `directory`, restrict the walk.
    fn walk_filter(&self, directory: &Path) -> PathFilter {
        PathFilter::new(directory, &self.config.exclude_patterns)
            .include_hidden(true)
            .include_only(&self.config.include_patterns)
    }
}

impl Default for SedTool {
    fn default() -> Self {
        Self::new(SedConfig::default())
    }
}

/// Backups from an earlier `backup: true` run must not be rewritten (or
/// backed up again) by a later directory-wide replacement.
fn is_replaceable_file(entry: &DirEntry) -> bool {
    entry.file_type().is_file() && entry.path().extension() != Some(OsStr::new(BACKUP_EXTENSION))
}

/// A compiled pattern and the text that replaces each of its matches.
#[derive(Clone, Copy)]
struct Substitution<'a> {
    regex: &'a Regex,
    replacement: &'a str,
}

#[derive(Default)]
struct Rewrite {
    content: String,
    replacements: usize,
    original_lines: Vec<String>,
    modified_lines: Vec<String>,
}

/// Apply `regex` line by line, keeping each line's original ending (`\n`,
/// `\r\n`, or none on the last line) so CRLF files stay CRLF.
fn rewrite_lines(content: &str, regex: &Regex, replacement: &str) -> Rewrite {
    let mut rewrite = Rewrite::default();
    for raw_line in content.split_inclusive('\n') {
        let line = raw_line
            .strip_suffix("\r\n")
            .or_else(|| raw_line.strip_suffix('\n'))
            .unwrap_or(raw_line);
        let ending = &raw_line[line.len()..];
        let new_line = regex.replace_all(line, replacement);
        if new_line != line {
            rewrite.replacements += 1;
        }
        rewrite.content.push_str(&new_line);
        rewrite.content.push_str(ending);
        rewrite.original_lines.push(line.to_string());
        rewrite.modified_lines.push(new_line.into_owned());
    }
    rewrite
}

/// Replace a file's content through a temporary file in the same directory
/// and a rename, so a crash or a concurrent reader never sees a truncated
/// file. Symlinks are resolved first so the link itself is kept, and the
/// original permissions are copied to the new file.
fn write_atomically(path: &Path, content: &str) -> Result<()> {
    let target = fs::canonicalize(path)?;
    let directory = target
        .parent()
        .ok_or_else(|| Error::Tool(format!("no parent directory for {}", path.display())))?;
    let permissions = fs::metadata(&target)?.permissions();

    let mut temp = tempfile::NamedTempFile::new_in(directory)?;
    temp.write_all(content.as_bytes())?;
    fs::set_permissions(temp.path(), permissions)?;
    temp.persist(&target).map_err(|err| Error::Io(err.error))?;
    Ok(())
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
        fs::write(
            &file,
            "Color::rgb(1.0, 0.0, 0.0)\nColor::rgb(0.5, 0.5, 0.5)",
        )
        .unwrap();

        let tool = SedTool::new(SedConfig {
            exclude_patterns: vec![],
            ..Default::default()
        });

        let result = tool
            .replace_in_file(r"Color::rgb", "Color::srgb", &file)
            .unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().replacements, 2);

        let content = fs::read_to_string(&file).unwrap();
        assert!(content.contains("Color::srgb"));
        assert!(!content.contains("Color::rgb"));
    }

    fn tool_without_excludes() -> SedTool {
        SedTool::new(SedConfig {
            exclude_patterns: vec![],
            ..Default::default()
        })
    }

    #[test]
    fn original_line_endings_are_preserved() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("crlf.txt");
        fs::write(&file, "hello\r\nworld\r\nhello\nend hello").unwrap();

        let result = tool_without_excludes()
            .replace_in_file("hello", "hi", &file)
            .unwrap()
            .unwrap();

        assert_eq!(result.replacements, 3);
        assert_eq!(
            fs::read_to_string(&file).unwrap(),
            "hi\r\nworld\r\nhi\nend hi"
        );
    }

    #[test]
    fn in_place_writes_leave_no_temporary_files_behind() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("only.txt");
        fs::write(&file, "hello\n").unwrap();

        tool_without_excludes()
            .replace_in_file("hello", "hi", &file)
            .unwrap();

        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, ["only.txt"]);
        assert_eq!(fs::read_to_string(&file).unwrap(), "hi\n");
    }

    #[cfg(unix)]
    #[test]
    fn in_place_writes_keep_permissions_and_symlinks() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempdir().unwrap();
        let target = dir.path().join("target.txt");
        let link = dir.path().join("link.txt");
        fs::write(&target, "hello\n").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o640)).unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();

        tool_without_excludes()
            .replace_in_file("hello", "hi", &link)
            .unwrap();

        assert!(
            fs::symlink_metadata(&link)
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert_eq!(fs::read_to_string(&target).unwrap(), "hi\n");
        let mode = fs::metadata(&target).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o640);
    }

    #[test]
    fn directory_mode_does_not_rewrite_backup_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo\n").unwrap();
        fs::write(dir.path().join("a.txt.bak"), "foo\n").unwrap();

        let report = tool_without_excludes()
            .replace_in_directory("foo", "bar", dir.path())
            .unwrap();

        assert_eq!(report.results.len(), 1);
        assert_eq!(
            fs::read_to_string(dir.path().join("a.txt")).unwrap(),
            "bar\n"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("a.txt.bak")).unwrap(),
            "foo\n"
        );
    }

    #[test]
    fn directory_mode_exclusions_ignore_directories_above_the_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("node_modules").join("project");
        fs::create_dir_all(root.join("dist")).unwrap();
        fs::write(root.join("a.txt"), "foo\n").unwrap();
        fs::write(root.join("dist").join("b.txt"), "foo\n").unwrap();

        let report = SedTool::default()
            .replace_in_directory("foo", "bar", &root)
            .unwrap();

        assert_eq!(report.results.len(), 1);
        assert_eq!(fs::read_to_string(root.join("a.txt")).unwrap(), "bar\n");
        assert_eq!(
            fs::read_to_string(root.join("dist").join("b.txt")).unwrap(),
            "foo\n"
        );
    }

    #[test]
    fn directory_mode_rejects_an_invalid_pattern() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo\n").unwrap();

        assert!(
            tool_without_excludes()
                .replace_in_directory("(", "bar", dir.path())
                .is_err()
        );
    }

    #[test]
    fn directory_mode_skips_binary_files_without_reporting_errors() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo\n").unwrap();
        fs::write(dir.path().join("blob.bin"), [0xff, 0xfe, 0x00, b'f']).unwrap();

        let report = tool_without_excludes()
            .replace_in_directory("foo", "bar", dir.path())
            .unwrap();

        assert_eq!(report.results.len(), 1);
        assert!(report.errors.is_empty(), "{:?}", report.errors);
        assert!(!report.timed_out);
    }

    #[test]
    fn directory_mode_reports_a_timeout() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo\n").unwrap();
        let tool = SedTool::new(SedConfig {
            timeout: Duration::ZERO,
            exclude_patterns: vec![],
            ..Default::default()
        });

        let report = tool.replace_in_directory("foo", "bar", dir.path()).unwrap();

        assert!(report.timed_out);
    }

    #[cfg(unix)]
    #[test]
    fn directory_mode_reports_files_it_cannot_read() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo\n").unwrap();
        let locked = dir.path().join("locked.txt");
        fs::write(&locked, "foo\n").unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read(&locked).is_ok() {
            // Running as root: permissions cannot make the file unreadable.
            return;
        }

        let report = tool_without_excludes()
            .replace_in_directory("foo", "bar", dir.path())
            .unwrap();

        assert_eq!(report.results.len(), 1);
        assert_eq!(report.errors.len(), 1);
        assert!(report.errors[0].file.ends_with("locked.txt"));
    }
}
