//! Background task manager for running shell commands asynchronously
//!
//! This module provides ability to run commands in background
//! and track their status, output, and results.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tracing::{debug, warn};

use crate::error::Result;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Running,
    Done,
    Error,
    Timeout,
}

impl TaskStatus {
    pub fn emoji(&self) -> &str {
        match self {
            TaskStatus::Pending => "⏸️",
            TaskStatus::Running => "⏳",
            TaskStatus::Done => "✅",
            TaskStatus::Error => "❌",
            TaskStatus::Timeout => "⏰",
        }
    }
}

#[derive(Debug, Clone)]
pub struct BackgroundTask {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub label: Option<String>,
    pub status: TaskStatus,
    pub output: String,
    pub error_output: String,
    pub exit_code: Option<i32>,
    pub start_time: Instant,
    pub end_time: Option<Instant>,
    pub timeout: Duration,
}

impl BackgroundTask {
    pub fn format_duration(&self) -> String {
        let end = self.end_time.unwrap_or_else(Instant::now);
        let elapsed = end.duration_since(self.start_time);

        let secs = elapsed.as_secs_f64();
        if secs < 60.0 {
            format!("{:.1}s", secs)
        } else {
            let mins = (secs / 60.0) as u64;
            let remaining_secs = (secs % 60.0) as u64;
            format!("{}m {}s", mins, remaining_secs)
        }
    }

    fn generate_id() -> String {
        use rand::Rng;
        const CHARSET: &[u8] = b"0123456789abcdef";
        let mut rng = rand::thread_rng();
        let id: String = (0..8)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect();
        format!("job_{}", id)
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RunOptions {
    pub command: String,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default = "default_timeout")]
    pub timeout: u64,
    #[serde(default)]
    pub label: Option<String>,
}

fn default_timeout() -> u64 {
    300_000
}

// ============================================================================
// Background Task Manager
// ============================================================================

pub struct BackgroundTaskManager {
    tasks: Arc<Mutex<HashMap<String, BackgroundTask>>>,
    debug_mode: bool,
}

impl BackgroundTaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            debug_mode: std::env::var("DEBUG_BACKGROUND").is_ok(),
        }
    }

    fn debug(&self, task_id: &str, message: &str) {
        if self.debug_mode {
            debug!("[BG-DEBUG] {}: {}", task_id, message);
        }
    }

    pub fn run(&self, options: RunOptions) -> Result<String> {
        let id = BackgroundTask::generate_id();
        let cwd = options
            .cwd
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

        let timeout_ms = options.timeout;
        let timeout = Duration::from_millis(timeout_ms);

        let mut task = BackgroundTask {
            id: id.clone(),
            command: options.command.clone(),
            args: vec![],
            cwd,
            label: options.label,
            status: TaskStatus::Running,
            output: String::new(),
            error_output: String::new(),
            exit_code: None,
            start_time: Instant::now(),
            end_time: None,
            timeout,
        };

        self.debug(
            &id,
            &format!("Starting: {} (cwd: {:?})", task.command, task.cwd),
        );

        let is_windows = cfg!(windows);
        let (shell, shell_flag) = if is_windows {
            ("cmd.exe", "/c")
        } else {
            ("/bin/sh", "-c")
        };

        let mut child = match Command::new(shell)
            .args([shell_flag, &task.command])
            .current_dir(&task.cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                task.status = TaskStatus::Error;
                task.error_output = format!("Failed to spawn: {}", e);
                task.end_time = Some(Instant::now());
                self.debug(&id, &format!("Spawn failed: {}", task.error_output));
                return Err(crate::error::Error::BackgroundTask(format!(
                    "Failed to spawn {}: {}",
                    task.command, e
                )));
            }
        };

        let _task_id_clone = id.clone();
        let command_clone = task.command.clone();

        let stdout = child.stdout.take().expect("Failed to take stdout");
        let stderr = child.stderr.take().expect("Failed to take stderr");

        let stdout_thread = std::thread::spawn(move || -> Box<String> {
            let reader = BufReader::new(stdout);
            let mut output = String::new();

            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        output.push_str(&text);
                        output.push('\n');
                    }
                    Err(_) => {}
                }
            }

            Box::new(output)
        });

        let stderr_thread = std::thread::spawn(move || -> Box<String> {
            let reader = BufReader::new(stderr);
            let mut error_output = String::new();

            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        error_output.push_str(&text);
                        error_output.push('\n');
                    }
                    Err(_) => {}
                }
            }

            Box::new(error_output)
        });

        let result = match child.wait() {
            Ok(exit_status) => {
                let code: Option<i32> = exit_status.code();
                task.exit_code = code;
                task.end_time = Some(Instant::now());
                task.status = if code == Some(0) {
                    TaskStatus::Done
                } else {
                    TaskStatus::Error
                };

                let duration = task
                    .end_time
                    .and_then(|end| Some(end.duration_since(task.start_time).as_secs_f64()))
                    .unwrap_or(0.0);
                self.debug(
                    &id,
                    &format!("Completed with code {:?} in {:.2}s", code, duration),
                );
                Ok(())
            }
            Err(e) => {
                task.status = TaskStatus::Error;
                task.error_output = format!("Process error: {}", e);
                task.end_time = Some(Instant::now());
                self.debug(&id, &format!("Error: {}", e));
                Err(())
            }
        };

        if result.is_err() {
            if let Err(e) = child.kill() {
                warn!("Failed to kill process: {}", e);
            }
        }

        task.output = stdout_thread
            .join()
            .unwrap_or(Box::new(String::new()))
            .to_string();
        task.error_output = stderr_thread
            .join()
            .unwrap_or(Box::new(String::new()))
            .to_string();

        self.tasks.lock().unwrap().insert(id.clone(), task.clone());

        Ok(format!(
            "🚀 **Background Task Started**{}\
             \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\
             \n| Property | Value |\
             \n|----------|-------|\
             \n| **Task ID** | `{}` |\
             \n| **Command** | `{}` |\
             \n| **Status** | {} {} |\
             \n| **Working Dir** | `{}` |\
             \n| **Timeout** | {}s |\
             \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\
             \n\n📌 **Next Step**: Use `check_background` with task ID `{}` to get results.",
            task.label
                .as_ref()
                .map(|l| format!(" ({})", l))
                .unwrap_or_default(),
            id,
            command_clone,
            task.status.emoji(),
            format!("{:?}", task.status).to_lowercase(),
            task.cwd.display(),
            timeout.as_secs(),
            id
        ))
    }

    pub fn get(&self, task_id: &str) -> Option<BackgroundTask> {
        self.tasks.lock().unwrap().get(task_id).cloned()
    }

    pub fn get_all(&self) -> Vec<BackgroundTask> {
        self.tasks.lock().unwrap().values().cloned().collect()
    }

    pub fn get_by_status(&self, status: TaskStatus) -> Vec<BackgroundTask> {
        self.get_all()
            .into_iter()
            .filter(|t| t.status == status)
            .collect()
    }

    pub fn clear_completed(&self) -> usize {
        let mut tasks = self.tasks.lock().unwrap();
        let initial_count = tasks.len();
        tasks.retain(|_, t| t.status == TaskStatus::Running || t.status == TaskStatus::Pending);
        let removed = initial_count - tasks.len();
        debug!("Cleared {} completed tasks", removed);
        removed
    }

    pub fn kill(&self, task_id: &str) -> Result<()> {
        let mut tasks = self.tasks.lock().unwrap();
        let task = tasks.get_mut(task_id);

        match task {
            Some(t) if t.status == TaskStatus::Running => {
                t.status = TaskStatus::Error;
                t.error_output = "Killed by user".to_string();
                t.end_time = Some(Instant::now());
                self.debug(task_id, "Killed by user");
                Ok(())
            }
            Some(t) => Err(crate::error::Error::BackgroundTask(format!(
                "Task {} is not running (status: {:?})",
                task_id, t.status
            ))),
            None => Err(crate::error::Error::BackgroundTask(format!(
                "Task {} not found",
                task_id
            ))),
        }
    }

    pub fn format_task_output(&self, task_id: &str, tail_lines: Option<usize>) -> Result<String> {
        let task = self.get(task_id).ok_or_else(|| {
            crate::error::Error::BackgroundTask(format!("Task {} not found", task_id))
        })?;

        let output = if let Some(tail) = tail_lines {
            truncate_output(&task.output, tail)
        } else {
            truncate_output(&task.output, 10000)
        };

        let error_output = if let Some(tail) = tail_lines {
            truncate_output(&task.error_output, tail)
        } else {
            truncate_output(&task.error_output, 10000)
        };

        let label_display = task
            .label
            .as_ref()
            .map(|l| format!(" ({})", l))
            .unwrap_or_default();

        let mut result = format!(
            "{} **Task {}**{}\
             \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\
             \n| Property | Value |\
             \n|----------|-------|\
             \n| **Command** | `{}` |\
             \n| **Status** | {} **{}** |\
             \n| **Duration** | {}{} |",
            task.status.emoji(),
            task.id,
            label_display,
            task.command,
            task.status.emoji(),
            format!("{:?}", task.status).to_lowercase(),
            task.format_duration(),
            if task.status == TaskStatus::Running {
                " (ongoing)"
            } else {
                ""
            }
        );

        if let Some(code) = task.exit_code {
            result.push_str(&format!("\n| **Exit Code** | {} |", code));
        }

        result.push_str("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if !output.trim().is_empty() {
            result.push_str("\n\n📤 **Output (stdout)**:\n```\n");
            result.push_str(&output.trim());
            result.push_str("\n```");
        }

        if !error_output.trim().is_empty() {
            result.push_str("\n\n⚠️ **Errors (stderr)**:\n```\n");
            result.push_str(&error_output.trim());
            result.push_str("\n```");
        }

        if task.status == TaskStatus::Running {
            result.push_str(&format!(
                "\n\n⏳ Task still running... Check again later with:\n`check_background({{ taskId: \"{}\" }})`",
                task.id
            ));
        }

        Ok(result)
    }

    pub fn list_tasks(&self, filter: Option<TaskStatus>) -> Result<String> {
        let mut tasks = match filter {
            Some(status) => self.get_by_status(status),
            None => self.get_all(),
        };

        if tasks.is_empty() {
            return Ok("📋 **No background tasks**\
                     \nUse `run_background` to start a new background task."
                .to_string());
        }

        tasks.sort_by(|a, b| b.start_time.cmp(&a.start_time));

        let running_count = tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Running)
            .count();
        let done_count = tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Done)
            .count();
        let error_count = tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Error || t.status == TaskStatus::Timeout)
            .count();

        let rows: Vec<String> = tasks
            .iter()
            .map(|t| {
                let cmd_short = if t.command.len() > 25 {
                    format!("{}...", &t.command[..22])
                } else {
                    t.command.clone()
                };
                let label_part = t
                    .label
                    .as_ref()
                    .map(|l| format!(" [{}]", l))
                    .unwrap_or_default();
                let status_str = format!("{:?}", t.status)
                    .to_lowercase()
                    .chars()
                    .take(7)
                    .collect::<String>();
                let cmd_str = cmd_short.chars().take(25).collect::<String>();
                let duration_str = t.format_duration();

                format!(
                    "| `{}` | {} {} | {}{} | {} |",
                    t.id,
                    t.status.emoji(),
                    pad_right(&status_str, 7),
                    pad_right(&cmd_str, 25),
                    label_part,
                    pad_left(&duration_str, 8)
                )
            })
            .collect();

        Ok(format!(
            "📋 **Background Tasks** ({} total)\
             \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\
             \n| ⏳ Running: {} | ✅ Done: {} | ❌ Error/Timeout: {} |\
             \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\
             \n| Task ID | Status | Command | Duration |\
             \n|---------|--------|---------|----------|\
             \n{}\n\n💡 Use `check_background({{ taskId: \"job_xxx\" }})` to see full output.",
            tasks.len(),
            running_count,
            done_count,
            error_count,
            rows.join("\n")
        ))
    }
}

fn truncate_output(output: &str, max_len: usize) -> String {
    if output.len() <= max_len {
        output.to_string()
    } else {
        let truncated_len = output.len() - max_len;
        format!(
            "[...truncated {} chars...]\n{}",
            truncated_len,
            &output[output.len() - max_len..]
        )
    }
}

fn pad_right(s: &str, width: usize) -> String {
    let len = s.chars().count();
    if len >= width {
        s.chars().take(width).collect()
    } else {
        let mut result = s.to_string();
        for _ in 0..(width - len) {
            result.push(' ');
        }
        result
    }
}

fn pad_left(s: &str, width: usize) -> String {
    let len = s.chars().count();
    if len >= width {
        s.chars().take(width).collect()
    } else {
        let mut result = s.to_string();
        for _ in 0..(width - len) {
            result.insert(0, ' ');
        }
        result
    }
}

impl Default for BackgroundTaskManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_generation() {
        let id1 = BackgroundTask::generate_id();
        let id2 = BackgroundTask::generate_id();
        assert_ne!(id1, id2);
        assert!(id1.starts_with("job_"));
        assert_eq!(id1.len(), 12);
    }

    #[test]
    fn test_status_emoji() {
        assert_eq!(TaskStatus::Pending.emoji(), "⏸️");
        assert_eq!(TaskStatus::Running.emoji(), "⏳");
        assert_eq!(TaskStatus::Done.emoji(), "✅");
        assert_eq!(TaskStatus::Error.emoji(), "❌");
        assert_eq!(TaskStatus::Timeout.emoji(), "⏰");
    }

    #[test]
    fn test_format_duration() {
        let task = BackgroundTask {
            id: "test".to_string(),
            command: "echo test".to_string(),
            args: vec![],
            cwd: PathBuf::new(),
            label: None,
            status: TaskStatus::Done,
            output: String::new(),
            error_output: String::new(),
            exit_code: Some(0),
            start_time: Instant::now(),
            end_time: None,
            timeout: Duration::from_secs(10),
        };

        let duration = task.format_duration();
        assert!(duration.contains("s") || duration.contains("m"));
    }
}
