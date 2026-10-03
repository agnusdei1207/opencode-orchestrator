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
use std::io::{self, BufRead, Read, Write};
use tracing::{debug, error, info, warn};
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
    for (id, role) in agent::ROLES {
        println!("  {:15} {}", id, role);
    }
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

    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout();
    let mut buf = Vec::new();

    loop {
        let response = match read_request_line(&mut stdin, &mut buf, MAX_REQUEST_LINE_BYTES) {
            Ok(LineRead::Eof) => return Ok(()),
            Ok(LineRead::Line(line)) => respond_to(&line).await,
            Ok(LineRead::TooLong) => {
                warn!(
                    limit = MAX_REQUEST_LINE_BYTES,
                    "Rejected oversized request line"
                );
                Some(oversized_request_response(&buf))
            }
            Err(e) => {
                error!("Read error: {}", e);
                continue;
            }
        };
        if let Some(response) = response {
            write_response(&mut stdout, &response)?;
        }
    }
}

/// Longest request line the server buffers; longer lines are skipped and
/// answered with an invalid-request error.
const MAX_REQUEST_LINE_BYTES: u64 = 16 * 1024 * 1024;
/// Characters of a client-supplied method name written to the debug log.
const MAX_LOGGED_METHOD_CHARS: usize = 64;
/// Bytes at the start of an oversized request line searched for its id; the
/// pool serializes `id` before `params`, so it sits near the start.
const ID_SCAN_BYTES: usize = 4096;

/// One read from the request stream.
#[derive(Debug, PartialEq, Eq)]
enum LineRead {
    Line(String),
    /// The line exceeded the limit. Only its first `limit + 1` bytes are left
    /// in the buffer; the rest was consumed without being buffered.
    TooLong,
    Eof,
}

/// Read one request line of at most `limit` bytes (excluding the line
/// ending). A longer line is skipped up to its newline so the next request
/// still parses. Invalid UTF-8 is an `InvalidData` error, as with `lines()`.
fn read_request_line(
    reader: &mut impl BufRead,
    buf: &mut Vec<u8>,
    limit: u64,
) -> io::Result<LineRead> {
    buf.clear();
    if reader.by_ref().take(limit + 1).read_until(b'\n', buf)? == 0 {
        return Ok(LineRead::Eof);
    }
    if !buf.ends_with(b"\n") && buf.len() as u64 > limit {
        reader.skip_until(b'\n')?;
        return Ok(LineRead::TooLong);
    }
    let text =
        std::str::from_utf8(buf).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let line = text.strip_suffix('\n').unwrap_or(text);
    Ok(LineRead::Line(
        line.strip_suffix('\r').unwrap_or(line).to_string(),
    ))
}

/// Reply to a line too long to parse. The TypeScript pool matches replies by
/// id, so the id is recovered from the start of the line when it can be;
/// otherwise the caller would wait out its request timeout.
fn oversized_request_response(line_start: &[u8]) -> Value {
    let message = format!("Invalid request: line exceeds {MAX_REQUEST_LINE_BYTES} bytes");
    let scanned = &line_start[..line_start.len().min(ID_SCAN_BYTES)];
    let id = top_level_id(scanned).map_or(Value::Null, Value::from);
    error_response(id, RpcError::new(rpc::INVALID_REQUEST, message))
}

/// The numeric `id` member of the top-level object that `prefix` starts.
/// `prefix` is the start of a JSON text, so the scan only tracks strings and
/// nesting; an `id` inside `params` or a string never counts.
fn top_level_id(prefix: &[u8]) -> Option<u64> {
    let mut depth = 0_usize;
    let mut index = 0;
    while index < prefix.len() {
        match prefix[index] {
            b'"' => {
                let end = string_end(prefix, index + 1)?;
                let text = &prefix[index + 1..end];
                if depth == 1
                    && text == field::ID.as_bytes()
                    && let Some(id) = number_after_colon(&prefix[end + 1..])
                {
                    return Some(id);
                }
                index = end;
            }
            b'{' | b'[' => depth += 1,
            b'}' | b']' => depth = depth.saturating_sub(1),
            _ => {}
        }
        index += 1;
    }
    None
}

/// Index of the quote closing the string whose contents begin at `start`.
fn string_end(bytes: &[u8], start: usize) -> Option<usize> {
    let mut index = start;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'"' => return Some(index),
            _ => index += 1,
        }
    }
    None
}

/// The unsigned integer in `: <digits>` at the start of `rest`. A number that
/// is not followed by a delimiter may continue past the scanned prefix, or be
/// a fraction, so it is rejected rather than misread.
fn number_after_colon(rest: &[u8]) -> Option<u64> {
    let value = rest
        .trim_ascii_start()
        .strip_prefix(b":")?
        .trim_ascii_start();
    let digits = value.iter().take_while(|b| b.is_ascii_digit()).count();
    let delimiter = *value.get(digits)?;
    if digits == 0 || !(delimiter == b',' || delimiter == b'}' || delimiter.is_ascii_whitespace()) {
        return None;
    }
    std::str::from_utf8(&value[..digits]).ok()?.parse().ok()
}

/// Answer one non-empty line. Only sizes are logged: requests and replies
/// carry file contents, HTTP headers and bodies.
async fn respond_to(line: &str) -> Option<Value> {
    if line.trim().is_empty() {
        return None;
    }
    debug!(bytes = line.len(), "Received request line");
    response_for_line(line).await
}

fn write_response(stdout: &mut impl Write, response: &Value) -> Result<()> {
    let text = serde_json::to_string(response)?;
    debug!(bytes = text.len(), "Sending response");
    writeln!(stdout, "{}", text)?;
    stdout.flush()?;
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
    let method: String = request
        .get(field::METHOD)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .chars()
        .take(MAX_LOGGED_METHOD_CHARS)
        .collect();
    debug!(method = %method, id = ?id, "Handling request");
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
                        "directory": {"type": "string", "description": "Search directory"},
                        "max_results": {"type": "number", "description": "Max results (default: 100, max: 1000)"}
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
                        "content2": {"type": "string"},
                        "ignore_whitespace": {"type": "boolean", "description": "Ignore whitespace differences"}
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

    #[test]
    fn tools_list_schemas_expose_every_accepted_argument() {
        let listed = tools_list_result();
        let properties = |name: &str| {
            listed["tools"]
                .as_array()
                .unwrap()
                .iter()
                .find(|t| t["name"] == name)
                .map(|t| t["inputSchema"]["properties"].clone())
                .unwrap()
        };

        assert!(properties(tool::GLOB_SEARCH).get("max_results").is_some());
        assert!(properties(tool::DIFF).get("ignore_whitespace").is_some());
    }

    #[tokio::test]
    async fn list_agents_tool_reports_the_shared_roster() {
        let output = tools::execute_tool(tool::LIST_AGENTS, json!({}))
            .await
            .unwrap();
        let listed: Value = serde_json::from_str(&output).unwrap();
        let ids: Vec<&str> = listed["agents"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|a| a["id"].as_str())
            .collect();

        assert_eq!(
            ids,
            [
                agent::COMMANDER,
                agent::PLANNER,
                agent::WORKER,
                agent::REVIEWER
            ]
        );
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

    fn read_all(input: &str, limit: u64) -> Vec<LineRead> {
        let mut reader = io::Cursor::new(input.as_bytes().to_vec());
        let mut buf = Vec::new();
        let mut lines = Vec::new();
        loop {
            match read_request_line(&mut reader, &mut buf, limit).unwrap() {
                LineRead::Eof => return lines,
                other => lines.push(other),
            }
        }
    }

    #[test]
    fn request_lines_over_the_limit_are_rejected_and_skipped() {
        let lines = read_all("{\"a\":1}\n0123456789abcdef\n{}\r\n", 8);

        assert_eq!(
            lines,
            [
                LineRead::Line("{\"a\":1}".to_string()),
                LineRead::TooLong,
                LineRead::Line("{}".to_string()),
            ]
        );
    }

    #[test]
    fn a_line_of_exactly_the_limit_is_accepted() {
        assert_eq!(
            read_all("12345678\n12345678", 8),
            [
                LineRead::Line("12345678".to_string()),
                LineRead::Line("12345678".to_string()),
            ]
        );
    }

    #[test]
    fn oversized_requests_get_an_invalid_request_reply() {
        assert_rpc_error(
            &oversized_request_response(b"not json at all"),
            Value::Null,
            rpc::INVALID_REQUEST,
        );
    }

    #[test]
    fn oversized_requests_reply_with_the_id_read_from_the_line_start() {
        let mut reader = io::Cursor::new(
            br#"{"jsonrpc":"2.0", "id" : 42,"method":"tools/call","params":{"x":"0123456789"}}"#
                .to_vec(),
        );
        let mut buf = Vec::new();

        let read = read_request_line(&mut reader, &mut buf, 48).unwrap();

        assert_eq!(read, LineRead::TooLong);
        assert_rpc_error(
            &oversized_request_response(&buf),
            json!(42),
            rpc::INVALID_REQUEST,
        );
    }

    #[test]
    fn oversized_request_ids_come_only_from_the_top_level_object() {
        let late_id = format!(r#"{{"params":"{}","id":9}}"#, "x".repeat(ID_SCAN_BYTES));
        let lines: [&[u8]; 5] = [
            br#"{"params":{"id":7,"x":"#,
            br#"{"method":"\"id\":5","params":"#,
            br#"{"jsonrpc":"2.0","id":12"#,
            br#"{"jsonrpc":"2.0","id":1.5,"#,
            late_id.as_bytes(),
        ];

        for line in lines {
            let response = oversized_request_response(line);
            assert_eq!(
                response[field::ID],
                Value::Null,
                "{}",
                String::from_utf8_lossy(line)
            );
        }
    }

    #[tokio::test]
    async fn unparseable_lines_get_a_parse_error_reply() {
        let resp = response_for_line("{not json")
            .await
            .expect("parse errors are answered");
        assert_rpc_error(&resp, Value::Null, rpc::PARSE_ERROR);
    }
}
