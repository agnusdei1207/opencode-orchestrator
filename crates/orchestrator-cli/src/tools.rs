//! Tool implementations for the orchestrator CLI

use anyhow::Result;
use orchestrator_core::hooks::Hook;
use orchestrator_core::tools::{
    GlobTool, GrepTool, MgrepTool, SedTool, DiffTool, JqTool, HttpTool, FileStatsTool, GitTool,
    DiagnosticsTool, AstTool,
    glob::GlobConfig, grep::GrepConfig, mgrep::MgrepConfig, sed::SedConfig,
    diff::DiffConfig, jq::JqConfig, http::HttpConfig,
    lsp::DiagnosticsConfig, ast::AstConfig,
};

use orchestrator_core::constants::{tool, status};
use serde::Deserialize;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::time::Duration;
use std::collections::HashMap;

/// Execute a tool by name
pub async fn execute_tool(name: &str, arguments: Value) -> Result<String> {
    match name {
        tool::GREP_SEARCH => grep_search(arguments).await,
        tool::GLOB_SEARCH => glob_search(arguments).await,
        tool::MGREP => mgrep(arguments).await,
        tool::SED_REPLACE => sed_replace(arguments).await,
        tool::DIFF => diff_files(arguments).await,
        tool::JQ => jq_query(arguments).await,
        tool::HTTP => http_request(arguments).await,
        tool::FILE_STATS => file_stats(arguments).await,
        tool::GIT_DIFF => git_diff(arguments).await,
        tool::GIT_STATUS => git_status(arguments).await,
        tool::LSP_DIAGNOSTICS => lsp_diagnostics(arguments).await,
        tool::AST_SEARCH => ast_search(arguments).await,
        tool::AST_REPLACE => ast_replace(arguments).await,
        tool::LIST_AGENTS => list_agents().await,
        tool::LIST_HOOKS => list_hooks().await,
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
    max_results_per_pattern: Option<usize>,
}

/// Multi-pattern grep - search multiple patterns in parallel
async fn mgrep(arguments: Value) -> Result<String> {
    let args: MgrepArgs = serde_json::from_value(arguments)?;

    if args.patterns.is_empty() {
        return Ok(json!({"error": "No patterns provided"}).to_string());
    }

    let mut config = MgrepConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }
    if let Some(max) = args.max_results_per_pattern {
        config.max_results_per_pattern = max;
    }

    let search_dir = args
        .directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

    let tool = MgrepTool::new(config);
    let result = tool.search(&args.patterns, &search_dir)?;

    // Format results
    let mut all_results = Vec::new();
    for (pattern, matches) in &result.results {
        let formatted: Vec<Value> = matches
            .iter()
            .map(|m| {
                json!({
                    "file": m.file.clone(),
                    "line": m.line,
                    "content": m.content.trim()
                })
            })
            .collect();

        all_results.push(json!({
            "pattern": pattern,
            "matches": formatted,
            "total": matches.len()
        }));
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

/// List all available agents (4-agent architecture)
async fn list_agents() -> Result<String> {
    let agents = vec![
        json!({
            "id": "Commander",
            "description": "Autonomous orchestrator - executes until mission complete"
        }),
        json!({
            "id": "Planner",
            "description": "Strategic planning and research specialist"
        }),
        json!({
            "id": "Worker",
            "description": "Implementation and documentation specialist"
        }),
        json!({
            "id": "Reviewer",
            "description": "Verification and context management specialist"
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

#[derive(Deserialize)]
struct SedArgs {
    pattern: String,
    replacement: String,
    file: Option<String>,
    directory: Option<String>,
    timeout_ms: Option<u64>,
    dry_run: Option<bool>,
    backup: Option<bool>,
}

/// Sed-like find and replace tool
async fn sed_replace(arguments: Value) -> Result<String> {
    let args: SedArgs = serde_json::from_value(arguments)?;

    let mut config = SedConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }
    if let Some(dry) = args.dry_run {
        config.dry_run = dry;
    }
    if let Some(backup) = args.backup {
        config.backup = backup;
    }

    let tool = SedTool::new(config);

    // Single file mode
    if let Some(file_path) = args.file {
        let path = PathBuf::from(&file_path);
        match tool.replace_in_file(&args.pattern, &args.replacement, &path) {
            Ok(Some(result)) => {
                Ok(serde_json::to_string_pretty(&json!({
                    "success": true,
                    "file": result.file,
                    "replacements": result.replacements,
                    "dry_run": args.dry_run.unwrap_or(false)
                }))?)
            }
            Ok(None) => {
                Ok(serde_json::to_string_pretty(&json!({
                    "success": true,
                    "file": file_path,
                    "replacements": 0,
                    "message": "No matches found"
                }))?)
            }
            Err(e) => {
                Ok(serde_json::to_string_pretty(&json!({
                    "success": false,
                    "error": e.to_string()
                }))?)
            }
        }
    }
    // Directory mode
    else if let Some(dir_path) = args.directory {
        let path = PathBuf::from(&dir_path);
        match tool.replace_in_directory(&args.pattern, &args.replacement, &path) {
            Ok(results) => {
                let total_replacements: usize = results.iter().map(|r| r.replacements).sum();
                let files: Vec<Value> = results
                    .iter()
                    .map(|r| {
                        json!({
                            "file": r.file,
                            "replacements": r.replacements
                        })
                    })
                    .collect();

                Ok(serde_json::to_string_pretty(&json!({
                    "success": true,
                    "files_modified": results.len(),
                    "total_replacements": total_replacements,
                    "files": files,
                    "dry_run": args.dry_run.unwrap_or(false)
                }))?)
            }
            Err(e) => {
                Ok(serde_json::to_string_pretty(&json!({
                    "success": false,
                    "error": e.to_string()
                }))?)
            }
        }
    } else {
        Ok(serde_json::to_string_pretty(&json!({
            "success": false,
            "error": "Either 'file' or 'directory' must be specified"
        }))?)
    }
}

// ========== DIFF TOOL ==========

#[derive(Deserialize)]
struct DiffArgs {
    file1: Option<String>,
    file2: Option<String>,
    content1: Option<String>,
    content2: Option<String>,
    ignore_whitespace: Option<bool>,
}

async fn diff_files(arguments: Value) -> Result<String> {
    let args: DiffArgs = serde_json::from_value(arguments)?;
    
    let mut config = DiffConfig::default();
    if let Some(ignore_ws) = args.ignore_whitespace {
        config.ignore_whitespace = ignore_ws;
    }
    
    let tool = DiffTool::new(config);
    
    let result = if let (Some(f1), Some(f2)) = (&args.file1, &args.file2) {
        tool.diff_files(&PathBuf::from(f1), &PathBuf::from(f2))?
    } else if let (Some(c1), Some(c2)) = (&args.content1, &args.content2) {
        tool.diff_strings(c1, c2)?
    } else {
        return Ok(json!({"error": "Provide file1+file2 or content1+content2"}).to_string());
    };
    
    Ok(serde_json::to_string_pretty(&json!({
        "has_differences": result.has_differences,
        "additions": result.additions,
        "deletions": result.deletions,
        "diff": result.diff_output
    }))?)
}

// ========== JQ TOOL ==========

#[derive(Deserialize)]
struct JqArgs {
    json_input: Option<String>,
    file: Option<String>,
    expression: String,
    raw_output: Option<bool>,
}

async fn jq_query(arguments: Value) -> Result<String> {
    let args: JqArgs = serde_json::from_value(arguments)?;
    
    let mut config = JqConfig::default();
    if let Some(raw) = args.raw_output {
        config.raw_output = raw;
    }
    
    let tool = JqTool::new(config);
    
    let result = if let Some(input) = args.json_input {
        tool.query(&input, &args.expression)?
    } else if let Some(file_path) = args.file {
        tool.query_file(&PathBuf::from(file_path), &args.expression)?
    } else {
        return Ok(json!({"error": "Provide json_input or file"}).to_string());
    };
    
    Ok(serde_json::to_string_pretty(&json!({
        "result": result
    }))?)
}

// ========== HTTP TOOL ==========

#[derive(Deserialize)]
struct HttpArgs {
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    timeout_ms: Option<u64>,
}

async fn http_request(arguments: Value) -> Result<String> {
    let args: HttpArgs = serde_json::from_value(arguments)?;
    
    let mut config = HttpConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }
    
    let tool = HttpTool::new(config);
    
    use orchestrator_core::tools::http::HttpMethod;
    let method = match args.method.as_deref().unwrap_or("GET").to_uppercase().as_str() {
        "POST" => HttpMethod::POST,
        "PUT" => HttpMethod::PUT,
        "DELETE" => HttpMethod::DELETE,
        "PATCH" => HttpMethod::PATCH,
        "HEAD" => HttpMethod::HEAD,
        _ => HttpMethod::GET,
    };
    
    let result = tool.request(method, &args.url, args.headers.as_ref(), args.body.as_deref())?;
    
    Ok(serde_json::to_string_pretty(&json!({
        "status_code": result.status_code,
        "headers": result.headers,
        "body": result.body
    }))?)
}

// ========== FILE STATS TOOL ==========

#[derive(Deserialize)]
struct FileStatsArgs {
    directory: String,
    max_depth: Option<usize>,
}

async fn file_stats(arguments: Value) -> Result<String> {
    let args: FileStatsArgs = serde_json::from_value(arguments)?;
    
    let tool = FileStatsTool::new();
    let stats = tool.analyze(&PathBuf::from(&args.directory), args.max_depth)?;
    
    let file_types: Vec<Value> = stats.file_types.iter().take(10).map(|ft| {
        json!({
            "extension": ft.extension,
            "count": ft.count,
            "total_lines": ft.total_lines
        })
    }).collect();
    
    Ok(serde_json::to_string_pretty(&json!({
        "total_files": stats.total_files,
        "total_dirs": stats.total_dirs,
        "total_size_bytes": stats.total_size,
        "total_lines": stats.total_lines,
        "file_types": file_types,
        "largest_files": stats.largest_files
    }))?)
}

// ========== GIT TOOLS ==========

#[derive(Deserialize)]
struct GitDiffArgs {
    directory: Option<String>,
    staged_only: Option<bool>,
}

async fn git_diff(arguments: Value) -> Result<String> {
    let args: GitDiffArgs = serde_json::from_value(arguments)?;
    
    let tool = GitTool::new();
    let repo_path = args.directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let stats = tool.diff(&repo_path, args.staged_only.unwrap_or(false))?;
    
    Ok(serde_json::to_string_pretty(&json!({
        "files_changed": stats.files_changed,
        "insertions": stats.insertions,
        "deletions": stats.deletions,
        "diff": stats.diff_output
    }))?)
}

#[derive(Deserialize)]
struct GitStatusArgs {
    directory: Option<String>,
}

async fn git_status(arguments: Value) -> Result<String> {
    let args: GitStatusArgs = serde_json::from_value(arguments)?;
    
    let tool = GitTool::new();
    let repo_path = args.directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let files = tool.status(&repo_path)?;
    let branch = tool.current_branch(&repo_path).unwrap_or_else(|_| "unknown".to_string());
    
    let file_list: Vec<Value> = files.iter().map(|f| {
        json!({
            "file": f.file,
            "status": f.status
        })
    }).collect();
    
    Ok(serde_json::to_string_pretty(&json!({
        "branch": branch,
        "files": file_list,
        "total_changed": files.len()
    }))?)
}

// ========== LSP DIAGNOSTICS TOOL ==========

#[derive(Deserialize)]
struct LspDiagnosticsArgs {
    directory: Option<String>,
    file: Option<String>,
    include_warnings: Option<bool>,
}

async fn lsp_diagnostics(arguments: Value) -> Result<String> {
    let args: LspDiagnosticsArgs = serde_json::from_value(arguments)?;
    
    let mut config = DiagnosticsConfig::default();
    if let Some(include_warnings) = args.include_warnings {
        config.include_warnings = include_warnings;
    }
    
    let directory = args.directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let tool = DiagnosticsTool::new(config);
    let diagnostics = tool.get_diagnostics(&directory, args.file.as_deref())?;
    
    if diagnostics.is_empty() {
        return Ok(json!({"status": status::CLEAN, "message": "No diagnostics found. All clean!"}).to_string());
    }
    
    let errors: Vec<&_> = diagnostics.iter().filter(|d| matches!(d.severity, orchestrator_core::tools::lsp::DiagnosticSeverity::Error)).collect();
    let warnings: Vec<&_> = diagnostics.iter().filter(|d| matches!(d.severity, orchestrator_core::tools::lsp::DiagnosticSeverity::Warning)).collect();

    
    let diag_list: Vec<Value> = diagnostics.iter().take(50).map(|d| {
        json!({
            "file": d.file,
            "line": d.line,
            "column": d.column,
            "severity": format!("{:?}", d.severity).to_lowercase(),
            "message": d.message,
            "source": d.source,
            "code": d.code
        })
    }).collect();
    
    Ok(serde_json::to_string_pretty(&json!({
        "status": if !errors.is_empty() { status::ERROR } else if !warnings.is_empty() { status::WARNING } else { status::CLEAN },
        "summary": format!("{} error(s), {} warning(s)", errors.len(), warnings.len()),
        "diagnostics": diag_list,
        "total": diagnostics.len()
    }))?)
}

// ========== AST SEARCH TOOL ==========

#[derive(Deserialize)]
struct AstSearchArgs {
    pattern: String,
    directory: Option<String>,
    lang: Option<String>,
    include: Option<String>,
}

async fn ast_search(arguments: Value) -> Result<String> {
    let args: AstSearchArgs = serde_json::from_value(arguments)?;
    
    let directory = args.directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let tool = AstTool::new(AstConfig::default());
    let matches = tool.search(&args.pattern, &directory, args.lang.as_deref(), args.include.as_deref())?;
    
    if matches.is_empty() {
        return Ok(json!({"matches": [], "total": 0, "message": "No structural matches found."}).to_string());
    }
    
    let match_list: Vec<Value> = matches.iter().take(50).map(|m| {
        json!({
            "file": m.file,
            "line": m.line,
            "column": m.column,
            "content": m.content,
            "matched_text": m.matched_text
        })
    }).collect();
    
    Ok(serde_json::to_string_pretty(&json!({
        "matches": match_list,
        "total": matches.len()
    }))?)
}

// ========== AST REPLACE TOOL ==========

#[derive(Deserialize)]
struct AstReplaceArgs {
    pattern: String,
    rewrite: String,
    directory: Option<String>,
    lang: Option<String>,
    include: Option<String>,
}

async fn ast_replace(arguments: Value) -> Result<String> {
    let args: AstReplaceArgs = serde_json::from_value(arguments)?;
    
    let directory = args.directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let tool = AstTool::new(AstConfig::default());
    let result = tool.replace(&args.pattern, &args.rewrite, &directory, args.lang.as_deref(), args.include.as_deref())?;
    
    Ok(serde_json::to_string_pretty(&json!({
        "success": result.success,
        "message": result.message,
        "pattern": args.pattern,
        "rewrite": args.rewrite
    }))?)
}
