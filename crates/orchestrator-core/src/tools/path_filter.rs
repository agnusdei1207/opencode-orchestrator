//! Walk filters shared by the search tools.
//!
//! Hidden-name and glob rules are evaluated on the path relative to the search
//! root, so the directories a project happens to live under (`~/build/app`,
//! `/tmp/.work/app`, ...) never hide the project itself.

use glob::Pattern;
use std::path::{Path, PathBuf};

/// Decides which walked entries a tool may visit.
#[derive(Debug, Clone)]
pub(crate) struct PathFilter {
    root: PathBuf,
    include_hidden: bool,
    exclude: Vec<Pattern>,
    /// `None` admits everything; `Some` admits only matching entries.
    include: Option<Vec<Pattern>>,
}

impl PathFilter {
    /// Skip hidden entries and those matching any of `exclude`. Patterns that
    /// do not compile are ignored.
    pub(crate) fn new(root: &Path, exclude: &[String]) -> Self {
        Self {
            root: root.to_path_buf(),
            include_hidden: false,
            exclude: compile(exclude),
            include: None,
        }
    }

    pub(crate) fn include_hidden(mut self, include_hidden: bool) -> Self {
        self.include_hidden = include_hidden;
        self
    }

    /// When `patterns` is non-empty, admit only entries matching one of them.
    pub(crate) fn include_only(mut self, patterns: &[String]) -> Self {
        self.include = (!patterns.is_empty()).then(|| compile(patterns));
        self
    }

    /// Whether `path`, an entry below the root, should be visited. The root
    /// itself is always visited.
    pub(crate) fn allows(&self, path: &Path) -> bool {
        let relative = path.strip_prefix(&self.root).unwrap_or(path);
        if relative.as_os_str().is_empty() {
            return true;
        }
        if !self.include_hidden && is_hidden(relative) {
            return false;
        }
        if self.is_excluded(relative) {
            return false;
        }
        self.include
            .as_ref()
            .is_none_or(|patterns| patterns.iter().any(|p| p.matches_path(relative)))
    }

    /// `dir/**` also excludes `dir` itself, so the whole tree is pruned
    /// instead of visiting the directory and rejecting each child.
    fn is_excluded(&self, relative: &Path) -> bool {
        let as_directory = relative.join("");
        self.exclude
            .iter()
            .any(|p| p.matches_path(relative) || p.matches_path(&as_directory))
    }
}

/// Dependency, VCS and build-output trees that searches and statistics skip.
pub(crate) const HEAVY_DIRECTORY_EXCLUDES: &[&str] = &[
    "**/node_modules/**",
    "**/.git/**",
    "**/target/**",
    "**/dist/**",
    "**/build/**",
];

pub(crate) fn heavy_directory_excludes() -> Vec<String> {
    HEAVY_DIRECTORY_EXCLUDES
        .iter()
        .map(|pattern| pattern.to_string())
        .collect()
}

fn compile(patterns: &[String]) -> Vec<Pattern> {
    patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect()
}

fn is_hidden(relative: &Path) -> bool {
    relative
        .file_name()
        .is_some_and(|name| name.to_string_lossy().starts_with('.'))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn patterns_apply_below_the_root_only() {
        let root = Path::new("/home/user/build/app");
        let filter = PathFilter::new(root, &strings(&["**/build/**", "**/node_modules/**"]));

        assert!(filter.allows(root));
        assert!(filter.allows(&root.join("src/main.rs")));
        assert!(!filter.allows(&root.join("node_modules/x/index.js")));
        assert!(!filter.allows(&root.join("node_modules")));
        assert!(filter.allows(&root.join("node_modules_backup")));
        assert!(!filter.allows(&root.join("sub/build/out.o")));
    }

    #[test]
    fn hidden_entries_are_judged_by_their_own_name() {
        let root = Path::new("/tmp/.work/app");
        let filter = PathFilter::new(root, &[]);

        assert!(filter.allows(&root.join("src")));
        assert!(!filter.allows(&root.join(".git")));
        assert!(
            filter
                .clone()
                .include_hidden(true)
                .allows(&root.join(".git"))
        );
    }

    #[test]
    fn include_patterns_restrict_entries_when_present() {
        let root = Path::new("/repo");
        let filter = PathFilter::new(root, &[]).include_only(&strings(&["*.rs"]));

        assert!(filter.allows(&root.join("lib.rs")));
        assert!(!filter.allows(&root.join("lib.ts")));
        assert!(
            PathFilter::new(root, &[])
                .include_only(&[])
                .allows(&root.join("lib.ts"))
        );
    }
}
