//! Git operations tool

use crate::tools::process::run_with_timeout;
use crate::{Error, Result};
use std::path::Path;
use std::process::{Command, Output};
use std::time::Duration;

/// Hard ceiling for a single `git` invocation.
const GIT_TIMEOUT: Duration = Duration::from_secs(30);
/// Untranslated messages so `--stat` summaries and errors parse the same everywhere.
const GIT_LOCALE: &str = "C";
/// Global options that keep output plain text: no pager, no color escapes.
const GIT_GLOBAL_ARGS: &[&str] = &["--no-pager", "-c", "color.ui=false"];
/// Exit code of `git symbolic-ref -q HEAD` when HEAD is detached.
const DETACHED_HEAD_EXIT_CODE: i32 = 1;
/// What `git rev-parse --abbrev-ref HEAD` prints for a detached HEAD.
const DETACHED_HEAD_NAME: &str = "HEAD";

/// Git diff statistics
#[derive(Debug, Clone)]
pub struct GitDiffStats {
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
    pub diff_output: String,
}

/// Git file status
#[derive(Debug, Clone)]
pub struct GitFileStatus {
    pub file: String,
    pub status: String, // M, A, D, R, C, U, ?
}

/// Git tool for repository operations
pub struct GitTool;

impl GitTool {
    pub fn new() -> Self {
        Self
    }

    /// Get diff for uncommitted changes
    pub fn diff(&self, repo_path: &Path, staged_only: bool) -> Result<GitDiffStats> {
        // An external diff driver would replace the unified diff we parse.
        let mut diff_args = vec!["diff", "--no-ext-diff"];
        if staged_only {
            diff_args.push("--staged");
        }
        let diff_output = run_git(repo_path, &diff_args)?;

        diff_args.push("--stat");
        let stats_text = run_git(repo_path, &diff_args)?;

        // Parse stats from last line (e.g., "3 files changed, 10 insertions(+), 5 deletions(-)")
        let (files_changed, insertions, deletions) = self.parse_stat_line(&stats_text);

        Ok(GitDiffStats {
            files_changed,
            insertions,
            deletions,
            diff_output,
        })
    }

    /// Get status of files
    pub fn status(&self, repo_path: &Path) -> Result<Vec<GitFileStatus>> {
        let text = run_git(repo_path, &["status", "--porcelain"])?;
        let mut files = Vec::new();

        for line in text.lines() {
            if line.len() >= 3 {
                let status = line[0..2].trim().to_string();
                let file = line[3..].to_string();
                files.push(GitFileStatus { file, status });
            }
        }

        Ok(files)
    }

    /// Get recent commits
    pub fn log(&self, repo_path: &Path, count: usize) -> Result<Vec<String>> {
        let count = count.to_string();
        let text = run_git(repo_path, &["log", "--oneline", "-n", &count])?;
        Ok(text.lines().map(|s| s.to_string()).collect())
    }

    /// Get current branch, or `HEAD` when HEAD is detached.
    pub fn current_branch(&self, repo_path: &Path) -> Result<String> {
        // Unlike `rev-parse --abbrev-ref HEAD`, `symbolic-ref` also resolves an
        // unborn branch in a repository without commits.
        let args = ["symbolic-ref", "--short", "-q", "HEAD"];
        let output = run_with_timeout(git_command(repo_path, &args), GIT_TIMEOUT, None)?;
        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        if output.status.code() == Some(DETACHED_HEAD_EXIT_CODE) {
            return Ok(DETACHED_HEAD_NAME.to_string());
        }
        Err(git_failure(&args, &output))
    }

    /// Get list of modified files
    pub fn modified_files(&self, repo_path: &Path) -> Result<Vec<String>> {
        let text = run_git(repo_path, &["diff", "--no-ext-diff", "--name-only"])?;
        Ok(text
            .lines()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect())
    }

    fn parse_stat_line(&self, text: &str) -> (usize, usize, usize) {
        let last_line = text.lines().last().unwrap_or("");

        let mut files = 0;
        let mut insertions = 0;
        let mut deletions = 0;

        for part in last_line.split(',') {
            let part = part.trim();
            if part.contains("file") {
                files = part
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if part.contains("insertion") {
                insertions = part
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if part.contains("deletion") {
                deletions = part
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            }
        }

        (files, insertions, deletions)
    }
}

fn git_command(repo_path: &Path, args: &[&str]) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path)
        .env("LC_ALL", GIT_LOCALE)
        .args(GIT_GLOBAL_ARGS)
        .args(args);
    cmd
}

/// Run git and return its stdout, treating a non-zero exit as an error so a
/// missing repository is never mistaken for a clean one.
fn run_git(repo_path: &Path, args: &[&str]) -> Result<String> {
    let output = run_with_timeout(git_command(repo_path, args), GIT_TIMEOUT, None)?;
    if !output.status.success() {
        return Err(git_failure(args, &output));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn git_failure(args: &[&str], output: &Output) -> Error {
    Error::Tool(format!(
        "git {} failed ({}): {}",
        args.join(" "),
        output.status,
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

impl Default for GitTool {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn git_in(dir: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(["-c", "user.name=test", "-c", "user.email=test@example.com"])
            .args(args)
            .current_dir(dir)
            .status()
            .expect("git must be installed for git tool tests");
        assert!(status.success(), "git {args:?} failed");
    }

    #[test]
    fn commands_outside_a_repository_are_errors_not_clean_results() {
        let dir = tempdir().unwrap();
        let tool = GitTool::new();

        assert!(tool.status(dir.path()).is_err());
        assert!(tool.diff(dir.path(), false).is_err());
        assert!(tool.current_branch(dir.path()).is_err());
        assert!(tool.modified_files(dir.path()).is_err());
        assert!(tool.log(dir.path(), 1).is_err());
    }

    #[test]
    fn status_and_diff_work_in_a_fresh_repository() {
        let dir = tempdir().unwrap();
        git_in(dir.path(), &["init", "-q"]);
        fs::write(dir.path().join("new.txt"), "x").unwrap();
        let tool = GitTool::new();

        let files = tool.status(dir.path()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].file, "new.txt");
        assert_eq!(files[0].status, "??");
        assert_eq!(tool.diff(dir.path(), false).unwrap().files_changed, 0);
    }

    #[test]
    fn current_branch_works_on_an_unborn_branch() {
        let dir = tempdir().unwrap();
        git_in(dir.path(), &["init", "-q", "-b", "trunk"]);

        assert_eq!(GitTool::new().current_branch(dir.path()).unwrap(), "trunk");
    }

    #[test]
    fn current_branch_reports_head_when_detached() {
        let dir = tempdir().unwrap();
        git_in(dir.path(), &["init", "-q"]);
        git_in(dir.path(), &["commit", "-q", "--allow-empty", "-m", "init"]);
        git_in(dir.path(), &["checkout", "-q", "--detach"]);

        assert_eq!(GitTool::new().current_branch(dir.path()).unwrap(), "HEAD");
    }

    #[test]
    fn git_commands_force_parseable_output() {
        let command = git_command(Path::new("."), &["diff", "--stat"]);
        let args: Vec<_> = command.get_args().collect();
        assert_eq!(
            args,
            ["--no-pager", "-c", "color.ui=false", "diff", "--stat"]
        );
        assert!(
            command
                .get_envs()
                .any(|(key, value)| key == "LC_ALL" && value == Some("C".as_ref()))
        );
    }

    #[test]
    fn test_parse_stat_line() {
        let tool = GitTool::new();
        let text = " 3 files changed, 10 insertions(+), 5 deletions(-)\n";
        let (files, insertions, deletions) = tool.parse_stat_line(text);

        assert_eq!(files, 3);
        assert_eq!(insertions, 10);
        assert_eq!(deletions, 5);
    }

    #[test]
    fn test_parse_stat_line_empty() {
        let tool = GitTool::new();
        let (files, insertions, deletions) = tool.parse_stat_line("");

        assert_eq!(files, 0);
        assert_eq!(insertions, 0);
        assert_eq!(deletions, 0);
    }
}
