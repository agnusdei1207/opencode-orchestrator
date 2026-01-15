//! Tool implementations for the orchestrator CLI

use anyhow::Result;
use orchestrator_core::hooks::Hook;
use orchestrator_core::tools::{glob::GlobConfig, grep::GrepConfig, GlobTool, GrepTool};
use orchestrator_core::{
    run_background as core_run_background,
    check_background as core_check_background,
    list_background as core_list_background,
    kill_background as core_kill_background,
    format_duration, status_emoji, TaskStatus,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Duration;

/// Execute a tool by name
pub async fn execute_tool(name: &str, arguments: Value) -> Result<String> {
    match name {
        "grep_search" => grep_search(arguments).await,
        "glob_search" => glob_search(arguments).await,
        "mgrep" => mgrep(arguments).await,  // Multi-pattern grep (parallel)
        "list_agents" => list_agents().await,
        "list_hooks" => list_hooks().await,
        // Background task tools
        "run_background" => run_background(arguments).await,
        "check_background" => check_background(arguments).await,
        "list_background" => list_background(arguments).await,
        "kill_background" => kill_background(arguments).await,
        _ => Err(anyhow::anyhow!("Unknown tool: {}", name)),
    }
}

#[derive(Deserialize)]
struct GrepArgs {
    pattern: String,
    directory: Option<String>,
    timeout_ms: Option<u64>,
    max_results: Option<usize>,
}

async fn grep_search(arguments: Value) -> Result<String> {
    let args: GrepArgs = serde_json::from_value(arguments)?;

    let mut config = GrepConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }
    if let Some(max) = args.max_results {
        config.max_results = max;
    }

    let search_dir = args
        .directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

    let tool = GrepTool::new(config);
    let results = tool.search(&args.pattern, &search_dir)?;

    let output: Vec<Value> = results
        .iter()
        .take(50)
        .map(|m| {
            json!({
                "file": m.file,
                "line": m.line_number,
                "content": m.line_content.chars().take(200).collect::<String>()
            })
        })
        .collect();

    Ok(serde_json::to_string_pretty(&json!({
        "matches": output,
        "total": results.len()
    }))?)
}

// ============================================================================
// Multi-grep (mgrep) - Parallel multi-pattern search
// ============================================================================

#[derive(Deserialize)]
struct MgrepArgs {
    patterns: Vec<String>,
    directory: Option<String>,
    max_results_per_pattern: Option<usize>,
}

/// Multi-pattern grep - searches multiple patterns in parallel
async fn mgrep(arguments: Value) -> Result<String> {
    let args: MgrepArgs = serde_json::from_value(arguments)?;
    
    let search_dir = args
        .directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let max_per_pattern = args.max_results_per_pattern.unwrap_or(50);
    
    let mut config = GrepConfig::default();
    config.timeout = Duration::from_secs(30);
    config.max_results = max_per_pattern;
    
    let tool = GrepTool::new(config);
    let mut all_results: Vec<Value> = Vec::new();
    let mut pattern_summaries: Vec<String> = Vec::new();
    
    for pattern in &args.patterns {
        match tool.search(pattern, &search_dir) {
            Ok(results) => {
                let count = results.len().min(max_per_pattern);
                pattern_summaries.push(format!("\"{}\" → {} matches", pattern, count));
                
                let matches: Vec<Value> = results
                    .iter()
                    .take(max_per_pattern)
                    .map(|m| {
                        json!({
                            "pattern": pattern,
                            "file": m.file,
                            "line": m.line_number,
                            "content": m.line_content.chars().take(150).collect::<String>()
                        })
                    })
                    .collect();
                
                all_results.extend(matches);
            }
            Err(e) => {
                pattern_summaries.push(format!("\"{}\" → error: {}", pattern, e));
            }
        }
    }
    
    Ok(format!(
        r#"🔍 **Multi-Grep Results** ({} patterns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total matches: {}

{}

🦀 **Engine**: Rust (parallel execution)"#,
        args.patterns.len(),
        pattern_summaries.join("\n"),
        all_results.len(),
        serde_json::to_string_pretty(&all_results)?
    ))
}

#[derive(Deserialize)]
struct GlobArgs {
    pattern: String,
    directory: Option<String>,
    timeout_ms: Option<u64>,
    max_results: Option<usize>,
}

async fn glob_search(arguments: Value) -> Result<String> {
    let args: GlobArgs = serde_json::from_value(arguments)?;

    let mut config = GlobConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }
    if let Some(max) = args.max_results {
        config.max_results = max;
    }

    let search_dir = args
        .directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

    let tool = GlobTool::new(config);
    let results = tool.find(&args.pattern, &search_dir)?;

    let files: Vec<String> = results
        .iter()
        .take(100)
        .map(|p| p.display().to_string())
        .collect();

    Ok(serde_json::to_string_pretty(&json!({
        "files": files,
        "total": results.len()
    }))?)
}

/// List all available agents (6-agent micro-tasking architecture)
async fn list_agents() -> Result<String> {
    let agents = vec![
        json!({
            "id": "orchestrator",
            "description": "Traffic controller - routes tasks, never executes directly"
        }),
        json!({
            "id": "planner",
            "description": "Micro-task decomposition - breaks work into atomic units"
        }),
        json!({
            "id": "coder",
            "description": "Single-focus execution - one task at a time"
        }),
        json!({
            "id": "reviewer",
            "description": "Quality gate - style, errors, modern stack, security"
        }),
        json!({
            "id": "fixer",
            "description": "Minimal fixes - one error at a time, no refactoring"
        }),
        json!({
            "id": "searcher",
            "description": "Context provider - find patterns before coding"
        }),
    ];

    Ok(serde_json::to_string_pretty(&json!({"agents": agents}))?)
}

async fn list_hooks() -> Result<String> {
    let hooks: Vec<Value> = Hook::all()
        .iter()
        .map(|h| {
            json!({
                "name": h.to_string(),
                "description": h.description()
            })
        })
        .collect();

    Ok(serde_json::to_string_pretty(&json!({"hooks": hooks}))?)
}

// ============================================================================
// Background Task Tools (Rust-native implementation)
// ============================================================================

#[derive(Deserialize)]
struct RunBackgroundArgs {
    command: String,
    cwd: Option<String>,
    timeout: Option<u64>,
    label: Option<String>,
}

/// Run a command in the background
async fn run_background(arguments: Value) -> Result<String> {
    let args: RunBackgroundArgs = serde_json::from_value(arguments)?;
    
    let task = core_run_background(
        &args.command,
        args.cwd.as_deref(),
        args.label.as_deref(),
        args.timeout,
    )?;
    
    let label_display = args.label.map(|l| format!(" ({})", l)).unwrap_or_default();
    
    Ok(format!(
r#"🚀 **Background Task Started**{}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Property      | Value |
|---------------|-------|
| **Task ID**   | `{}` |
| **Command**   | `{}` |
| **Status**    | {} {} |
| **Working Dir** | {} |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 **Next Step**: Use `check_background` with task ID `{}` to get results.
🦀 **Engine**: Rust (native performance)"#,
        label_display,
        task.id,
        task.command,
        status_emoji(&task.status),
        task.status,
        task.cwd,
        task.id
    ))
}

#[derive(Deserialize)]
struct CheckBackgroundArgs {
    #[serde(rename = "taskId")]
    task_id: String,
    #[serde(rename = "tailLines")]
    tail_lines: Option<usize>,
}

/// Check background task status
async fn check_background(arguments: Value) -> Result<String> {
    let args: CheckBackgroundArgs = serde_json::from_value(arguments)?;
    
    match core_check_background(&args.task_id)? {
        Some(task) => {
            let duration = format_duration(task.start_time, task.end_time);
            let emoji = status_emoji(&task.status);
            let label_display = task.label.map(|l| format!(" ({})", l)).unwrap_or_default();
            
            let mut output = task.output.clone();
            let mut stderr = task.error_output.clone();
            
            // Tail lines if requested
            if let Some(n) = args.tail_lines {
                let lines: Vec<&str> = output.lines().collect();
                output = lines.into_iter().rev().take(n).collect::<Vec<_>>().into_iter().rev()
                    .collect::<Vec<_>>().join("\n");
                    
                let err_lines: Vec<&str> = stderr.lines().collect();
                stderr = err_lines.into_iter().rev().take(n).collect::<Vec<_>>().into_iter().rev()
                    .collect::<Vec<_>>().join("\n");
            }
            
            // Truncate very long output
            if output.len() > 10000 {
                output = format!("[...truncated {} chars...]\n{}", 
                    output.len() - 8000, 
                    &output[output.len()-8000..]);
            }
            
            let mut result = format!(
r#"{} **Task {}**{}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Property      | Value |
|---------------|-------|
| **Command**   | `{}` |
| **Status**    | {} **{}** |
| **Duration**  | {}{} |"#,
                emoji,
                task.id,
                label_display,
                task.command,
                emoji,
                task.status.to_string().to_uppercase(),
                duration,
                if task.status == TaskStatus::Running { " (ongoing)" } else { "" }
            );
            
            if let Some(code) = task.exit_code {
                result.push_str(&format!("\n| **Exit Code** | {} |", code));
            }
            
            result.push_str("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            
            if !output.trim().is_empty() {
                result.push_str(&format!("\n\n📤 **Output (stdout)**:\n```\n{}\n```", output.trim()));
            }
            
            if !stderr.trim().is_empty() {
                result.push_str(&format!("\n\n⚠️ **Errors (stderr)**:\n```\n{}\n```", stderr.trim()));
            }
            
            if task.status == TaskStatus::Running {
                result.push_str(&format!(
                    "\n\n⏳ Task still running... Check again later with:\n`check_background({{ taskId: \"{}\" }})`",
                    task.id
                ));
            }
            
            result.push_str("\n\n🦀 **Engine**: Rust (native performance)");
            
            Ok(result)
        }
        None => {
            // List available tasks
            let tasks = core_list_background(None)?;
            if tasks.is_empty() {
                Ok(format!("❌ Task `{}` not found. No background tasks exist.", args.task_id))
            } else {
                let task_list: Vec<String> = tasks.iter()
                    .map(|t| format!("- `{}`: {}...", t.id, &t.command[..t.command.len().min(30)]))
                    .collect();
                Ok(format!(
                    "❌ Task `{}` not found.\n\n**Available tasks:**\n{}",
                    args.task_id,
                    task_list.join("\n")
                ))
            }
        }
    }
}

#[derive(Deserialize, Default)]
struct ListBackgroundArgs {
    status: Option<String>,
}

/// List all background tasks
async fn list_background(arguments: Value) -> Result<String> {
    let args: ListBackgroundArgs = serde_json::from_value(arguments).unwrap_or_default();
    
    let status_str = args.status.clone();
    let status_filter = status_str.as_ref().and_then(|s| match s.as_str() {
        "running" => Some(TaskStatus::Running),
        "done" => Some(TaskStatus::Done),
        "error" => Some(TaskStatus::Error),
        _ => None,
    });
    
    let tasks = core_list_background(status_filter)?;
    
    if tasks.is_empty() {
        let filter_msg = args.status.map(|s| format!(" with status \"{}\"", s)).unwrap_or_default();
        return Ok(format!(
            "📋 **No background tasks**{}\n\nUse `run_background` to start a new background task.\n\n🦀 **Engine**: Rust (native performance)",
            filter_msg
        ));
    }
    
    let rows: Vec<String> = tasks.iter().map(|task| {
        let emoji = status_emoji(&task.status);
        let duration = format_duration(task.start_time, task.end_time);
        let cmd_short = if task.command.len() > 25 {
            format!("{}...", &task.command[..22])
        } else {
            task.command.clone()
        };
        let label_part = task.label.as_ref().map(|l| format!(" [{}]", l)).unwrap_or_default();
        
        format!(
            "| `{}` | {} {:7} | {}{} | {:>8} |",
            task.id,
            emoji,
            task.status,
            cmd_short,
            label_part,
            duration
        )
    }).collect();
    
    let running_count = tasks.iter().filter(|t| t.status == TaskStatus::Running).count();
    let done_count = tasks.iter().filter(|t| t.status == TaskStatus::Done).count();
    let error_count = tasks.iter().filter(|t| t.status == TaskStatus::Error || t.status == TaskStatus::Timeout).count();
    
    Ok(format!(
r#"📋 **Background Tasks** ({} total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| ⏳ Running: {} | ✅ Done: {} | ❌ Error/Timeout: {} |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Task ID | Status | Command | Duration |
|---------|--------|---------|----------|
{}

💡 Use `check_background({{ taskId: "job_xxxxx" }})` to see full output.
🦀 **Engine**: Rust (native performance)"#,
        tasks.len(),
        running_count,
        done_count,
        error_count,
        rows.join("\n")
    ))
}

#[derive(Deserialize)]
struct KillBackgroundArgs {
    #[serde(rename = "taskId")]
    task_id: String,
}

/// Kill a running background task
async fn kill_background(arguments: Value) -> Result<String> {
    let args: KillBackgroundArgs = serde_json::from_value(arguments)?;
    
    // First check if task exists
    let task = core_check_background(&args.task_id)?;
    
    match task {
        Some(t) => {
            if t.status != TaskStatus::Running {
                return Ok(format!(
                    "⚠️ Task `{}` is not running (status: {}).",
                    args.task_id,
                    t.status
                ));
            }
            
            let killed = core_kill_background(&args.task_id)?;
            
            if killed {
                Ok(format!(
r#"🛑 Task `{}` has been killed.
Command: `{}`
Duration before kill: {}
🦀 **Engine**: Rust (native performance)"#,
                    args.task_id,
                    t.command,
                    format_duration(t.start_time, None)
                ))
            } else {
                Ok(format!(
                    "⚠️ Could not kill task `{}`. It may have already finished.",
                    args.task_id
                ))
            }
        }
        None => Ok(format!("❌ Task `{}` not found.", args.task_id)),
    }
}

