//! OpenCode Orchestrator CLI
//!
//! Bundled Rust utility server and operator CLI for the OpenCode Orchestrator plugin.
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

use anyhow::Result;
use orchestrator_core::constants::{agent, field, rpc, tool};
use orchestrator_core::hooks::Hook;
use serde_json::{Value, json};
use std::env;
use std::io::{self, BufRead, Write};
use tracing::{debug, error, info};
use tracing_subscriber::EnvFilter;

mod shell_listener;
mod tools;

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    match args.get(1).map(|s| s.as_str()) {
        Some("serve") => serve().await,
        Some("hooks") => list_hooks(),
        Some("agents") => list_agents(),
        Some("shell-listener") => shell_listener::run(&args[2..]),
        Some("--version") | Some("-V") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
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
    eprintln!("  hooks      List Rust hook metadata");
    eprintln!("  agents     List bundled agent presets");
    eprintln!("  shell-listener  Run authorized lab TCP session TUI");
    eprintln!("  serve      Run tool server (called by OpenCode)");
    eprintln!("  --version  Show version");
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
    println!("Mission-loop settings are managed by the OpenCode plugin configuration.");

    Ok(())
}

/// List available agents
fn list_agents() -> Result<()> {
    println!("🤖 Available Agents (4-Agent Architecture)");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!();
    println!("  {:15} Role", "ID");
    println!("  {:15} {}", "─".repeat(15), "─".repeat(45));
    println!(
        "  {:15} Autonomous orchestrator - executes until mission complete",
        agent::COMMANDER
    );
    println!(
        "  {:15} Strategic planning and research specialist",
        agent::PLANNER
    );
    println!(
        "  {:15} Implementation and documentation specialist",
        agent::WORKER
    );
    println!(
        "  {:15} Verification and context management specialist",
        agent::REVIEWER
    );
    println!();
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Configure models in OpenCode under agent.<name>.model.");

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

        if let Some(resp) = response_for_line(&line).await {
            let resp_str = serde_json::to_string(&resp)?;
            debug!("Sending: {}", resp_str);
            writeln!(stdout, "{}", resp_str)?;
            stdout.flush()?;
        }
    }

    Ok(())
}

/// A JSON-RPC error object.
#[derive(Debug)]
struct RpcError {
    code: i64,
    message: String,
}

impl RpcError {
    fn new(code: i64, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

/// Answer one stdin line. Unparseable JSON gets a parse error with a null id
/// as JSON-RPC 2.0 requires, since no id can be read from it.
async fn response_for_line(line: &str) -> Option<Value> {
    match serde_json::from_str::<Value>(line) {
        Ok(request) => handle_request(&request).await,
        Err(e) => {
            error!("Parse error: {}", e);
            let error = RpcError::new(rpc::PARSE_ERROR, format!("Parse error: {e}"));
            Some(error_response(Value::Null, error))
        }
    }
}

/// Handle JSON-RPC request.
///
/// Every request that carries an id gets a reply, an error object included,
/// so the TypeScript pool never waits for its request timeout. Notifications
/// (no id) are not answered when they fail.
async fn handle_request(request: &Value) -> Option<Value> {
    let id = request.get(field::ID).cloned();
    match dispatch(request).await {
        Ok(result) => Some(json!({
            "jsonrpc": rpc::VERSION,
            field::ID: id,
            field::RESULT: result
        })),
        Err(error) => {
            debug!("Request failed: {}", error.message);
            id.map(|id| error_response(id, error))
        }
    }
}

fn error_response(id: Value, error: RpcError) -> Value {
    json!({
        "jsonrpc": rpc::VERSION,
        field::ID: id,
        field::ERROR: {
            field::CODE: error.code,
            field::MESSAGE: error.message
        }
    })
}

async fn dispatch(request: &Value) -> std::result::Result<Value, RpcError> {
    let method = request
        .get(field::METHOD)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::new(rpc::INVALID_REQUEST, "Invalid request: missing method"))?;

    match method {
        rpc::INITIALIZE => Ok(initialize_result()),
        rpc::TOOLS_LIST => Ok(tools_list_result()),
        rpc::TOOLS_CALL => tools_call(request).await,
        _ => Err(RpcError::new(
            rpc::METHOD_NOT_FOUND,
            format!("Method not found: {method}"),
        )),
    }
}

fn initialize_result() -> Value {
    json!({
        "protocolVersion": rpc::PROTOCOL_VERSION,
        "serverInfo": {
            "name": "orchestrator",
            "version": env!("CARGO_PKG_VERSION")
        },
        "capabilities": { "tools": {} }
    })
}

async fn tools_call(request: &Value) -> std::result::Result<Value, RpcError> {
    let invalid_params = |message: &str| RpcError::new(rpc::INVALID_PARAMS, message);
    let params = request
        .get(field::PARAMS)
        .ok_or_else(|| invalid_params("Invalid params: missing params"))?;
    let tool_name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid_params("Invalid params: missing tool name"))?;
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    Ok(match tools::execute_tool(tool_name, arguments).await {
        Ok(result) => json!({
            field::CONTENT: [{
                field::TYPE: field::TEXT,
                field::TEXT: result
            }]
        }),
        Err(e) => json!({
            field::CONTENT: [{
                field::TYPE: field::TEXT,
                field::TEXT: format!("Error: {}", e)
            }],
            field::IS_ERROR: true
        }),
    })
}

fn tools_list_result() -> Value {
    json!({
        "tools": [
            {
                "name": tool::GREP_SEARCH,
                "description": "Fast regex search with timeout protection",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Regex pattern"},
                        "directory": {"type": "string", "description": "Search directory"},
                        "max_results": {"type": "number", "description": "Max results (default: 100, max: 1000)"},
                        "timeout_ms": {"type": "number", "description": "Timeout in milliseconds (default: 30000; 0 uses the default)"}
                    },
                    "required": ["pattern"]
                }
            },
            {
                "name": tool::GLOB_SEARCH,
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
                "name": tool::MGREP,
                "description": "Search multiple patterns in parallel. Much faster than running grep multiple times.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "patterns": {"type": "array", "items": {"type": "string"}, "description": "Array of regex patterns to search"},
                        "directory": {"type": "string", "description": "Search directory (optional)"},
                        "max_results_per_pattern": {"type": "number", "description": "Max results per pattern (default: 50, max: 1000)"},
                        "timeout_ms": {"type": "number", "description": "Timeout in milliseconds (default: 60000; 0 uses the default)"}
                    },
                    "required": ["patterns"]
                }
            },
            {
                "name": tool::SED_REPLACE,
                "description": "Find and replace patterns in files (sed-like)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Regex pattern to find"},
                        "replacement": {"type": "string", "description": "Replacement string"},
                        "file": {"type": "string", "description": "Single file to modify"},
                        "directory": {"type": "string", "description": "Directory to modify (recursive)"},
                        "dry_run": {"type": "boolean", "description": "Preview changes without modifying (default: false)"},
                        "backup": {"type": "boolean", "description": "Create .bak backup (default: false)"},
                        "timeout_ms": {"type": "number", "description": "Timeout in milliseconds"}
                    },
                    "required": ["pattern", "replacement"]
                }
            },
            {
                "name": tool::DIFF,
                "description": "Compare two files or strings",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file1": {"type": "string"},
                        "file2": {"type": "string"},
                        "content1": {"type": "string"},
                        "content2": {"type": "string"}
                    }
                }
            },
            {
                "name": tool::JQ,
                "description": "Query and manipulate JSON using jq expressions",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "json_input": {"type": "string", "description": "JSON string to query"},
                        "file": {"type": "string", "description": "JSON file to query"},
                        "expression": {"type": "string", "description": "jq expression"},
                        "raw_output": {"type": "boolean", "description": "Return raw string output"}
                    },
                    "required": ["expression"]
                }
            },
            {
                "name": tool::HTTP,
                "description": "Make HTTP requests",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL to request"},
                        "method": {"type": "string", "description": "HTTP method"},
                        "headers": {"type": "object", "description": "Request headers"},
                        "body": {"type": "string", "description": "Request body"},
                        "timeout_ms": {"type": "number", "description": "Timeout in milliseconds"}
                    },
                    "required": ["url"]
                }
            },
            {
                "name": tool::FILE_STATS,
                "description": "Analyze file and directory statistics",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {"type": "string", "description": "Directory to analyze"},
                        "max_depth": {"type": "number", "description": "Maximum directory depth"}
                    },
                    "required": ["directory"]
                }
            },
            {
                "name": tool::GIT_DIFF,
                "description": "Show git diff of uncommitted changes",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {"type": "string", "description": "Repository directory"},
                        "staged_only": {"type": "boolean", "description": "Show only staged changes"}
                    }
                }
            },
            {
                "name": tool::GIT_STATUS,
                "description": "Show git repository status",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {"type": "string", "description": "Repository directory"}
                    }
                }
            },
            {
                "name": tool::LSP_DIAGNOSTICS,
                "description": "Get LSP diagnostics (errors/warnings) for files",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {"type": "string", "description": "Directory to check"},
                        "file": {"type": "string", "description": "Specific file or glob filter"},
                        "include_warnings": {"type": "boolean", "description": "Include warnings (default: true)"}
                    }
                }
            },
            {
                "name": tool::AST_SEARCH,
                "description": "Structural code search using ast-grep",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "ast-grep pattern (e.g. 'const $X = $Y')"},
                        "directory": {"type": "string", "description": "Directory to search"},
                        "lang": {"type": "string", "description": "Language (typescript, javascript, rust, etc)"},
                        "include": {"type": "string", "description": "Glob filter for files"}
                    },
                    "required": ["pattern"]
                }
            },
            {
                "name": tool::AST_REPLACE,
                "description": "Structural code replace using ast-grep",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "ast-grep search pattern"},
                        "rewrite": {"type": "string", "description": "ast-grep rewrite pattern"},
                        "directory": {"type": "string", "description": "Directory to modify"},
                        "lang": {"type": "string", "description": "Language"},
                        "include": {"type": "string", "description": "Glob filter"}
                    },
                    "required": ["pattern", "rewrite"]
                }
            },
            {
                "name": tool::LIST_AGENTS,
                "description": "List available agents",
                "inputSchema": {"type": "object", "properties": {}}
            },
            {
                "name": tool::LIST_HOOKS,
                "description": "List available hooks",
                "inputSchema": {"type": "object", "properties": {}}
            }
        ]
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_handle_initialize() {
        let req = json!({
            "jsonrpc": rpc::VERSION,
            field::ID: 1,
            field::METHOD: rpc::INITIALIZE
        });
        let resp = handle_request(&req).await.unwrap();
        assert_eq!(resp[field::RESULT]["serverInfo"]["name"], "orchestrator");
    }

    #[tokio::test]
    async fn test_handle_tools_list() {
        let req = json!({
            "jsonrpc": rpc::VERSION,
            field::ID: 1,
            field::METHOD: rpc::TOOLS_LIST
        });
        let resp = handle_request(&req).await.unwrap();
        let tools = resp[field::RESULT]["tools"].as_array().unwrap();
        let listed_names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();

        for expected in [
            tool::GREP_SEARCH,
            tool::GLOB_SEARCH,
            tool::MGREP,
            tool::SED_REPLACE,
            tool::DIFF,
            tool::JQ,
            tool::HTTP,
            tool::FILE_STATS,
            tool::GIT_DIFF,
            tool::GIT_STATUS,
            tool::LSP_DIAGNOSTICS,
            tool::AST_SEARCH,
            tool::AST_REPLACE,
            tool::LIST_AGENTS,
            tool::LIST_HOOKS,
        ] {
            assert!(
                listed_names.contains(&expected),
                "missing tool in tools/list: {expected}"
            );
        }
    }

    #[tokio::test]
    async fn test_handle_tools_call_unknown() {
        let req = json!({
            "jsonrpc": rpc::VERSION,
            field::ID: 1,
            field::METHOD: rpc::TOOLS_CALL,
            field::PARAMS: {
                "name": "non_existent_tool",
                "arguments": {}
            }
        });
        let resp = handle_request(&req).await.unwrap();
        assert!(
            resp[field::RESULT][field::CONTENT][0][field::TEXT]
                .as_str()
                .unwrap()
                .contains("Unknown tool")
        );
    }

    fn assert_rpc_error(response: &Value, id: Value, code: i64) {
        assert_eq!(response[field::ID], id);
        assert_eq!(response[field::ERROR][field::CODE], code);
        assert!(response[field::ERROR][field::MESSAGE].is_string());
        assert!(response.get(field::RESULT).is_none());
    }

    #[tokio::test]
    async fn tools_call_without_params_gets_an_invalid_params_error() {
        let req = json!({"jsonrpc": rpc::VERSION, field::ID: 7, field::METHOD: rpc::TOOLS_CALL});
        let resp = handle_request(&req)
            .await
            .expect("a request with an id needs a reply");
        assert_rpc_error(&resp, json!(7), rpc::INVALID_PARAMS);
    }

    #[tokio::test]
    async fn tools_call_without_a_tool_name_gets_an_invalid_params_error() {
        let req = json!({
            "jsonrpc": rpc::VERSION,
            field::ID: 8,
            field::METHOD: rpc::TOOLS_CALL,
            field::PARAMS: {"arguments": {}}
        });
        let resp = handle_request(&req)
            .await
            .expect("a request with an id needs a reply");
        assert_rpc_error(&resp, json!(8), rpc::INVALID_PARAMS);
    }

    #[tokio::test]
    async fn unknown_methods_get_a_method_not_found_error() {
        let req = json!({"jsonrpc": rpc::VERSION, field::ID: "abc", field::METHOD: "tools/nope"});
        let resp = handle_request(&req)
            .await
            .expect("a request with an id needs a reply");
        assert_rpc_error(&resp, json!("abc"), rpc::METHOD_NOT_FOUND);
    }

    #[tokio::test]
    async fn requests_without_a_method_get_an_invalid_request_error() {
        let req = json!({"jsonrpc": rpc::VERSION, field::ID: 9});
        let resp = handle_request(&req)
            .await
            .expect("a request with an id needs a reply");
        assert_rpc_error(&resp, json!(9), rpc::INVALID_REQUEST);
    }

    #[tokio::test]
    async fn notifications_never_get_error_replies() {
        let req = json!({"jsonrpc": rpc::VERSION, field::METHOD: "tools/nope"});
        assert!(handle_request(&req).await.is_none());
    }

    #[tokio::test]
    async fn unparseable_lines_get_a_parse_error_reply() {
        let resp = response_for_line("{not json")
            .await
            .expect("parse errors are answered");
        assert_rpc_error(&resp, Value::Null, rpc::PARSE_ERROR);
    }
}
