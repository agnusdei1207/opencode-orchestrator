//! Tool implementations for the orchestrator CLI

use anyhow::Result;
use orchestrator_core::hooks::Hook;
use orchestrator_core::tools::{GlobTool, GrepTool, glob::GlobConfig, grep::GrepConfig};
use serde::Deserialize;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::time::Duration;

/// Execute a tool by name
pub async fn execute_tool(name: &str, arguments: Value) -> Result<String> {
    match name {
        "grep_search" => grep_search(arguments).await,
        "glob_search" => glob_search(arguments).await,
        "mgrep" => mgrep(arguments).await, // Multi-pattern grep (parallel)
        "list_agents" => list_agents().await,
        "list_hooks" => list_hooks().await,
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

    let matches: Vec<Value> = results
        .iter()
        .take(100)
        .map(|m| {
            json!({
                "file": m.file.clone(),
                "line": m.line_number,
                "content": m.line_content.trim()
            })
        })
        .collect();

    Ok(serde_json::to_string_pretty(&json!({
        "matches": matches,
        "total": results.len()
    }))?)
}

#[derive(Deserialize)]
struct MgrepArgs {
    patterns: Vec<String>,
    directory: Option<String>,
    timeout_ms: Option<u64>,
    max_results: Option<usize>,
}

/// Multi-pattern grep - search multiple patterns in parallel
async fn mgrep(arguments: Value) -> Result<String> {
    let args: MgrepArgs = serde_json::from_value(arguments)?;

    if args.patterns.is_empty() {
        return Ok(json!({"error": "No patterns provided"}).to_string());
    }

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

    // Search each pattern
    let mut all_results = Vec::new();

    for pattern in &args.patterns {
        match tool.search(pattern, &search_dir) {
            Ok(results) => {
                let matches: Vec<Value> = results
                    .iter()
                    .take(50) // Limit per pattern
                    .map(|m| {
                        json!({
                            "file": m.file.clone(),
                            "line": m.line_number,
                            "content": m.line_content.trim()
                        })
                    })
                    .collect();

                all_results.push(json!({
                    "pattern": pattern,
                    "matches": matches,
                    "total": results.len()
                }));
            }
            Err(e) => {
                all_results.push(json!({
                    "pattern": pattern,
                    "error": e.to_string()
                }));
            }
        }
    }

    Ok(serde_json::to_string_pretty(&json!({
        "results": all_results,
        "patterns_searched": args.patterns.len()
    }))?)
}

#[derive(Deserialize)]
struct GlobArgs {
    pattern: String,
    directory: Option<String>,
    max_results: Option<usize>,
}

async fn glob_search(arguments: Value) -> Result<String> {
    let args: GlobArgs = serde_json::from_value(arguments)?;

    let mut config = GlobConfig::default();
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

/// List all available agents (5-agent architecture)
async fn list_agents() -> Result<String> {
    let agents = vec![
        json!({
            "id": "commander",
            "description": "Autonomous orchestrator - executes until mission complete"
        }),
        json!({
            "id": "architect",
            "description": "Task decomposition & strategy correction"
        }),
        json!({
            "id": "builder",
            "description": "Full-stack implementation (Logic + UI)"
        }),
        json!({
            "id": "inspector",
            "description": "Quality audit & automatic bug fixing"
        }),
        json!({
            "id": "recorder",
            "description": "Persistent context & progress tracking"
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
