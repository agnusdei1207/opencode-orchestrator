//! Background Task Manager for OpenCode Orchestrator
//!
//! Runs commands in the background and tracks their status via file-based storage.
//! This allows the AI to start long-running commands and check results later.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                 Background Task Flow                     │
//! ├─────────────────────────────────────────────────────────┤
//! │  1. run_background(cmd)                                  │
//! │     └─> spawn process, write to state file              │
//! │     └─> return task ID immediately                       │
//! │                                                          │
//! │  2. check_background(task_id)                           │
//! │     └─> read state file                                  │
//! │     └─> return status + output                           │
//! │                                                          │
//! │  State: /tmp/opencode-orchestrator/jobs.json            │
//! └─────────────────────────────────────────────────────────┘
//! ```

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Task status enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Running,
    Done,
    Error,
    Timeout,
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Pending => write!(f, "pending"),
            TaskStatus::Running => write!(f, "running"),
            TaskStatus::Done => write!(f, "done"),
            TaskStatus::Error => write!(f, "error"),
            TaskStatus::Timeout => write!(f, "timeout"),
        }
    }
}

/// Background task information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTask {
    pub id: String,
    pub command: String,
    pub cwd: String,
    pub label: Option<String>,
    pub status: TaskStatus,
    pub output: String,
    pub error_output: String,
    pub exit_code: Option<i32>,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub pid: Option<u32>,
}

/// State file structure
#[derive(Debug, Default, Serialize, Deserialize)]
struct TaskState {
    tasks: HashMap<String, BackgroundTask>,
}

/// Get the state file path
fn get_state_dir() -> PathBuf {
    let tmp = std::env::temp_dir();
    tmp.join("opencode-orchestrator")
}

fn get_state_file() -> PathBuf {
    get_state_dir().join("jobs.json")
}

/// Read state from file
fn read_state() -> Result<TaskState> {
    let path = get_state_file();
    if !path.exists() {
        return Ok(TaskState::default());
    }
    let content = fs::read_to_string(&path).context("Failed to read state file")?;
    let state: TaskState = serde_json::from_str(&content).unwrap_or_default();
    Ok(state)
}

/// Write state to file
fn write_state(state: &TaskState) -> Result<()> {
    let dir = get_state_dir();
    fs::create_dir_all(&dir).context("Failed to create state directory")?;
    
    let path = get_state_file();
    let content = serde_json::to_string_pretty(state)?;
    fs::write(&path, content).context("Failed to write state file")?;
    Ok(())
}

/// Generate a unique task ID
fn generate_task_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("job_{:08x}", (now & 0xFFFFFFFF) as u32)
}

/// Get current timestamp in seconds
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Run a command in the background
pub fn run_background(
    command: &str,
    cwd: Option<&str>,
    label: Option<&str>,
    timeout_secs: Option<u64>,
) -> Result<BackgroundTask> {
    let id = generate_task_id();
    let working_dir = cwd.unwrap_or(".").to_string();
    let timeout = timeout_secs.unwrap_or(300);
    
    tracing::info!("[BG-RUST] Starting task {}: {}", id, command);
    
    // Determine shell
    let (shell, shell_arg) = if cfg!(windows) {
        ("cmd.exe", "/c")
    } else {
        ("/bin/sh", "-c")
    };
    
    // Create task entry
    let mut task = BackgroundTask {
        id: id.clone(),
        command: command.to_string(),
        cwd: working_dir.clone(),
        label: label.map(|s| s.to_string()),
        status: TaskStatus::Running,
        output: String::new(),
        error_output: String::new(),
        exit_code: None,
        start_time: current_timestamp(),
        end_time: None,
        pid: None,
    };
    
    // Spawn the process
    let child = Command::new(shell)
        .arg(shell_arg)
        .arg(command)
        .current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    
    match child {
        Ok(mut child) => {
            task.pid = Some(child.id());
            
            // Save initial state
            let mut state = read_state()?;
            state.tasks.insert(id.clone(), task.clone());
            write_state(&state)?;
            
            // Spawn a thread to wait for completion and update state
            let task_id = id.clone();
            let _cmd_str = command.to_string();
            
            std::thread::spawn(move || {
                let start = Instant::now();
                let timeout_dur = Duration::from_secs(timeout);
                
                // Read stdout
                let mut stdout_content = String::new();
                let mut stderr_content = String::new();
                
                if let Some(stdout) = child.stdout.take() {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines().flatten() {
                        stdout_content.push_str(&line);
                        stdout_content.push('\n');
                        
                        // Check timeout
                        if start.elapsed() > timeout_dur {
                            let _ = child.kill();
                            break;
                        }
                    }
                }
                
                if let Some(stderr) = child.stderr.take() {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines().flatten() {
                        stderr_content.push_str(&line);
                        stderr_content.push('\n');
                    }
                }
                
                // Wait for process
                let result = child.wait();
                
                // Update state
                if let Ok(mut state) = read_state() {
                    if let Some(task) = state.tasks.get_mut(&task_id) {
                        task.output = stdout_content;
                        task.error_output = stderr_content;
                        task.end_time = Some(current_timestamp());
                        
                        if start.elapsed() > timeout_dur {
                            task.status = TaskStatus::Timeout;
                            task.error_output.push_str("\nProcess killed: timeout");
                            tracing::warn!("[BG-RUST] Task {} timed out", task_id);
                        } else if let Ok(status) = result {
                            task.exit_code = status.code();
                            task.status = if status.success() {
                                TaskStatus::Done
                            } else {
                                TaskStatus::Error
                            };
                            tracing::info!(
                                "[BG-RUST] Task {} completed with code {:?}",
                                task_id,
                                task.exit_code
                            );
                        } else {
                            task.status = TaskStatus::Error;
                            tracing::error!("[BG-RUST] Task {} failed to wait", task_id);
                        }
                        
                        let _ = write_state(&state);
                    }
                }
            });
            
            Ok(task)
        }
        Err(e) => {
            task.status = TaskStatus::Error;
            task.error_output = format!("Failed to spawn: {}", e);
            task.end_time = Some(current_timestamp());
            
            // Save error state
            let mut state = read_state()?;
            state.tasks.insert(id, task.clone());
            write_state(&state)?;
            
            Ok(task)
        }
    }
}

/// Check the status of a background task
pub fn check_background(task_id: &str) -> Result<Option<BackgroundTask>> {
    let state = read_state()?;
    Ok(state.tasks.get(task_id).cloned())
}

/// List all background tasks
pub fn list_background(status_filter: Option<TaskStatus>) -> Result<Vec<BackgroundTask>> {
    let state = read_state()?;
    let mut tasks: Vec<BackgroundTask> = state.tasks.values().cloned().collect();
    
    if let Some(filter) = status_filter {
        tasks.retain(|t| t.status == filter);
    }
    
    // Sort by start time (newest first)
    tasks.sort_by(|a, b| b.start_time.cmp(&a.start_time));
    
    Ok(tasks)
}

/// Kill a running background task
pub fn kill_background(task_id: &str) -> Result<bool> {
    let mut state = read_state()?;
    
    if let Some(task) = state.tasks.get_mut(task_id) {
        if task.status == TaskStatus::Running {
            if let Some(pid) = task.pid {
                // Try to kill the process
                #[cfg(unix)]
                {
                    let _ = Command::new("kill")
                        .arg("-9")
                        .arg(pid.to_string())
                        .spawn();
                }
                #[cfg(windows)]
                {
                    let _ = Command::new("taskkill")
                        .arg("/F")
                        .arg("/PID")
                        .arg(pid.to_string())
                        .spawn();
                }
                
                task.status = TaskStatus::Error;
                task.error_output.push_str("\nKilled by user");
                task.end_time = Some(current_timestamp());
                write_state(&state)?;
                
                tracing::info!("[BG-RUST] Task {} killed by user", task_id);
                return Ok(true);
            }
        }
    }
    
    Ok(false)
}

/// Clear completed tasks
pub fn clear_completed() -> Result<usize> {
    let mut state = read_state()?;
    let initial_count = state.tasks.len();
    
    state.tasks.retain(|_, t| t.status == TaskStatus::Running || t.status == TaskStatus::Pending);
    
    let removed = initial_count - state.tasks.len();
    write_state(&state)?;
    
    Ok(removed)
}

/// Format duration for display
pub fn format_duration(start: u64, end: Option<u64>) -> String {
    let end_time = end.unwrap_or_else(current_timestamp);
    let secs = end_time.saturating_sub(start);
    
    if secs < 60 {
        format!("{}.0s", secs)
    } else {
        let mins = secs / 60;
        let remaining = secs % 60;
        format!("{}m {}s", mins, remaining)
    }
}

/// Get status emoji
pub fn status_emoji(status: &TaskStatus) -> &'static str {
    match status {
        TaskStatus::Pending => "⏸️",
        TaskStatus::Running => "⏳",
        TaskStatus::Done => "✅",
        TaskStatus::Error => "❌",
        TaskStatus::Timeout => "⏰",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_run_simple_command() {
        let task = run_background("echo 'hello rust'", None, Some("test"), None).unwrap();
        assert_eq!(task.status, TaskStatus::Running);
        assert!(task.id.starts_with("job_"));
        
        // Wait a bit for completion
        thread::sleep(Duration::from_millis(500));
        
        let result = check_background(&task.id).unwrap();
        assert!(result.is_some());
        let task = result.unwrap();
        assert_eq!(task.status, TaskStatus::Done);
        assert!(task.output.contains("hello rust"));
    }

    #[test]
    fn test_list_tasks() {
        // Run a quick command
        let _ = run_background("echo 'list test'", None, Some("list_test"), None);
        
        thread::sleep(Duration::from_millis(300));
        
        let tasks = list_background(None).unwrap();
        assert!(!tasks.is_empty());
    }

    #[test]
    fn test_error_command() {
        let task = run_background("this_command_does_not_exist_12345", None, None, None).unwrap();
        
        // Wait longer for command to complete and update state
        for _ in 0..10 {
            thread::sleep(Duration::from_millis(200));
            if let Ok(Some(t)) = check_background(&task.id) {
                if t.status != TaskStatus::Running {
                    assert_eq!(t.status, TaskStatus::Error);
                    return;
                }
            }
        }
        
        // Final check
        let result = check_background(&task.id).unwrap();
        assert!(result.is_some(), "Task should exist");
        let task = result.unwrap();
        assert_eq!(task.status, TaskStatus::Error, "Invalid command should result in error");
    }
}
