//! OpenCode Orchestrator CLI
//!
//! CLI binary for OpenCode Orchestrator plugin.
//!
//! ## Usage
//!
//! ```bash
//! # Help
//! orchestrator --help
//!
//! # List hooks
//! orchestrator hooks
//!
//! # List agents
//! orchestrator agents
//!
//! # Run tool server (called by OpenCode)
//! orchestrator serve
//! ```

use anyhow::{Context, Result};
use orchestrator_core::hooks::Hook;
use serde_json::{Value, json};
use std::env;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use tracing::{debug, error, info};
use tracing_subscriber::EnvFilter;

mod tools;

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    match args.get(1).map(|s| s.as_str()) {
        Some("serve") => serve().await,
        Some("hooks") => list_hooks(),
        Some("agents") => list_agents(),
        Some("install") => install().await,
        Some("uninstall") => uninstall().await,
        Some("--help") | Some("-h") | None => {
            print_help();
            Ok(())
        }
        Some(cmd) => {
            eprintln!("Unknown command: {}", cmd);
            print_help();
            std::process::exit(1);
        }
    }
}

fn print_help() {
    eprintln!("OpenCode Orchestrator v{}", env!("CARGO_PKG_VERSION"));
    eprintln!();
    eprintln!("Usage: orchestrator <command>");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  hooks      List available hooks");
    eprintln!("  agents     List available agents");
    eprintln!("  serve      Run tool server (called by OpenCode)");
    eprintln!("  install    Register plugin with OpenCode");
    eprintln!("  uninstall  Remove plugin from OpenCode");
    eprintln!("  --help     Show this help");
}

/// List available hooks
fn list_hooks() -> Result<()> {
    println!("📌 Available Hooks");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!();

    println!("🔄 Autonomous Execution");
    println!("  auto        {}", Hook::Auto.description());
    println!();

    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("To disable in config: disabled_hooks: [\"auto\"]");

    Ok(())
}

/// List available agents
fn list_agents() -> Result<()> {
    println!("🤖 Available Agents (5-Agent Architecture)");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!();
    println!("  {:15} {}", "ID", "Role");
    println!("  {:15} {}", "─".repeat(15), "─".repeat(45));
    println!(
        "  {:15} {}",
        "Commander", "Autonomous orchestrator - executes until mission complete"
    );
    println!(
        "  {:15} {}",
        "Architect", "Task decomposition & strategy correction"
    );
    println!(
        "  {:15} {}",
        "Builder", "Full-stack implementation (Logic + UI)"
    );
    println!(
        "  {:15} {}",
        "Inspector", "Quality audit & automatic bug fixing"
    );
    println!(
        "  {:15} {}",
        "Recorder", "Persistent context & progress tracking"
    );
    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("To change model in config: agents.Builder.model = \"custom/model\"");

    Ok(())
}

/// Install: Add plugin config to opencode.json
async fn install() -> Result<()> {
    println!("🦀 OpenCode Orchestrator");
    println!();

    let config_path = get_opencode_config_path()?;
    println!("📁 Config: {}", config_path.display());

    let mut config: Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path)?;
        serde_json::from_str(&content).unwrap_or_else(|_| json!({}))
    } else {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        json!({})
    };

    // Add plugin
    let plugins = config
        .as_object_mut()
        .context("Config is not an object")?
        .entry("plugin")
        .or_insert_with(|| json!([]));

    if let Some(arr) = plugins.as_array_mut() {
        let plugin_name = "opencode-orchestrator";
        if !arr.iter().any(|v| v.as_str() == Some(plugin_name)) {
            arr.push(json!(plugin_name));
        }
    }

    let config_str = serde_json::to_string_pretty(&config)?;
    fs::write(&config_path, config_str)?;

    println!("✅ Installed!");
    println!();
    println!("Restart OpenCode to use.");
    println!();
    println!("Available commands:");
    println!("  orchestrator hooks   - List hooks");
    println!("  orchestrator agents  - List agents");

    Ok(())
}

/// Uninstall: Remove plugin config
async fn uninstall() -> Result<()> {
    println!("🗑️  Uninstalling");

    let config_path = get_opencode_config_path()?;

    if !config_path.exists() {
        println!("Config not found.");
        return Ok(());
    }

    let content = fs::read_to_string(&config_path)?;
    let mut config: Value = serde_json::from_str(&content)?;

    // Remove plugin
    if let Some(plugins) = config.get_mut("plugin").and_then(|p| p.as_array_mut()) {
        plugins.retain(|v| v.as_str() != Some("opencode-orchestrator"));
    }

    // Remove MCP entry if exists
    if let Some(mcp) = config.get_mut("mcp").and_then(|m| m.as_object_mut()) {
        mcp.remove("orchestrator");
    }

    let config_str = serde_json::to_string_pretty(&config)?;
    fs::write(&config_path, config_str)?;

    println!("✅ Uninstalled!");

    Ok(())
}

/// Serve: Run tool server on stdio
async fn serve() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_writer(io::stderr)
        .init();

    info!("OpenCode Orchestrator starting");

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                error!("Read error: {}", e);
                continue;
            }
        };

        if line.trim().is_empty() {
            continue;
        }

        debug!("Received: {}", line);

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                error!("Parse error: {}", e);
                continue;
            }
        };

        let response = handle_request(&request).await;

        if let Some(resp) = response {
            let resp_str = serde_json::to_string(&resp)?;
            debug!("Sending: {}", resp_str);
            writeln!(stdout, "{}", resp_str)?;
            stdout.flush()?;
        }
    }

    Ok(())
}

/// Handle JSON-RPC request
async fn handle_request(request: &Value) -> Option<Value> {
    let method = request.get("method")?.as_str()?;
    let id = request.get("id").cloned();

    let result = match method {
        "initialize" => {
            json!({
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "orchestrator",
                    "version": env!("CARGO_PKG_VERSION")
                },
                "capabilities": { "tools": {} }
            })
        }
        "tools/list" => {
            json!({
                "tools": [
                    {
                        "name": "grep_search",
                        "description": "Fast regex search with timeout protection",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "pattern": {"type": "string", "description": "Regex pattern"},
                                "directory": {"type": "string", "description": "Search directory"}
                            },
                            "required": ["pattern"]
                        }
                    },
                    {
                        "name": "glob_search",
                        "description": "Find files by glob pattern",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "pattern": {"type": "string", "description": "Glob pattern (e.g., **/*.rs)"},
                                "directory": {"type": "string", "description": "Search directory"}
                            },
                            "required": ["pattern"]
                        }
                    },
                    {
                        "name": "list_agents",
                        "description": "List available agents",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "list_hooks",
                        "description": "List available hooks",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "mgrep",
                        "description": "Search multiple patterns in parallel. Much faster than running grep multiple times.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "patterns": {"type": "array", "items": {"type": "string"}, "description": "Array of regex patterns to search"},
                                "directory": {"type": "string", "description": "Search directory (optional)"},
                                "max_results_per_pattern": {"type": "number", "description": "Max results per pattern (default: 50)"}
                            },
                            "required": ["patterns"]
                        }
                    }
                ]
            })
        }
        "tools/call" => {
            let params = request.get("params")?;
            let tool_name = params.get("name")?.as_str()?;
            let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

            match tools::execute_tool(tool_name, arguments).await {
                Ok(result) => json!({"content": [{"type": "text", "text": result}]}),
                Err(e) => {
                    json!({"content": [{"type": "text", "text": format!("Error: {}", e)}], "isError": true})
                }
            }
        }
        _ => {
            debug!("Unknown method: {}", method);
            return None;
        }
    };

    Some(json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    }))
}

fn get_opencode_config_path() -> Result<PathBuf> {
    if let Ok(xdg) = env::var("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(xdg).join("opencode").join("opencode.json"));
    }

    // 2. Try APPDATA (Windows legacy/native)
    if let Ok(appdata) = env::var("APPDATA") {
        return Ok(PathBuf::from(appdata)
            .join("opencode")
            .join("opencode.json"));
    }

    // 3. Try HOME or USERPROFILE (Windows) -> .config/opencode
    if let Ok(home) = env::var("HOME").or_else(|_| env::var("USERPROFILE")) {
        return Ok(PathBuf::from(home)
            .join(".config")
            .join("opencode")
            .join("opencode.json"));
    }

    Err(anyhow::anyhow!(
        "Could not determine config path (checked XDG_CONFIG_HOME, HOME, USERPROFILE, APPDATA)"
    ))
}
