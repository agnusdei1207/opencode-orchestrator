//! Tool implementations for the orchestrator CLI

use anyhow::Result;
use orchestrator_core::hooks::Hook;
use orchestrator_core::tools::{
    AstTool, DiagnosticsTool, DiffTool, FileStatsTool, GitTool, GlobTool, GrepTool, HttpTool,
    JqTool, MgrepTool, SedTool, ast::AstConfig, ast::AstScope, diff::DiffConfig, glob::GlobConfig,
    grep::GrepConfig, http::HttpConfig, http::HttpMethod, jq::JqConfig, lsp::Diagnostic,
    lsp::DiagnosticSeverity, lsp::DiagnosticsConfig, mgrep::MgrepConfig, mgrep::MgrepMatch,
    sed::SedConfig, sed::SedDirectoryReport,
};

use orchestrator_core::constants::{status, tool};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

/// Execute a tool by name. The tools themselves are synchronous; this stays
/// async for the RPC loop that awaits it.
pub async fn execute_tool(name: &str, arguments: Value) -> Result<String> {
    match name {
        tool::GREP_SEARCH => grep_search(arguments),
        tool::GLOB_SEARCH => glob_search(arguments),
        tool::MGREP => mgrep(arguments),
        tool::SED_REPLACE => sed_replace(arguments),
        tool::DIFF => diff_files(arguments),
        tool::JQ => jq_query(arguments),
        tool::HTTP => http_request(arguments),
        tool::FILE_STATS => file_stats(arguments),
        tool::GIT_DIFF => git_diff(arguments),
        tool::GIT_STATUS => git_status(arguments),
        tool::LSP_DIAGNOSTICS => lsp_diagnostics(arguments),
        tool::AST_SEARCH => ast_search(arguments),
        tool::AST_REPLACE => ast_replace(arguments),
        tool::LIST_AGENTS => list_agents(),
        tool::LIST_HOOKS => list_hooks(),
        _ => Err(anyhow::anyhow!("Unknown tool: {}", name)),
    }
}

/// Tools default to the process working directory when none is given.
fn resolve_directory(directory: Option<String>) -> PathBuf {
    directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
}

#[derive(Deserialize)]
struct GrepArgs {
    pattern: String,
    directory: Option<String>,
    timeout_ms: Option<u64>,
    max_results: Option<usize>,
}

fn grep_search(arguments: Value) -> Result<String> {
    let args: GrepArgs = serde_json::from_value(arguments)?;

    let mut config = GrepConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }
    if let Some(max) = args.max_results {
        config.max_results = max;
    }

    let search_dir = resolve_directory(args.directory);

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
fn mgrep(arguments: Value) -> Result<String> {
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

    let search_dir = resolve_directory(args.directory);

    let tool = MgrepTool::new(config);
    let result = tool.search(&args.patterns, &search_dir)?;

    let all_results: Vec<Value> = result
        .results
        .iter()
        .map(|(pattern, matches)| mgrep_pattern_json(pattern, matches))
        .collect();

    Ok(serde_json::to_string_pretty(&json!({
        "results": all_results,
        "patterns_searched": args.patterns.len()
    }))?)
}

fn mgrep_pattern_json(pattern: &str, matches: &[MgrepMatch]) -> Value {
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

    json!({
        "pattern": pattern,
        "matches": formatted,
        "total": matches.len()
    })
}

#[derive(Deserialize)]
struct GlobArgs {
    pattern: String,
    directory: Option<String>,
    max_results: Option<usize>,
}

fn glob_search(arguments: Value) -> Result<String> {
    let args: GlobArgs = serde_json::from_value(arguments)?;

    let mut config = GlobConfig::default();
    if let Some(max) = args.max_results {
        config.max_results = max;
    }

    let search_dir = resolve_directory(args.directory);

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
fn list_agents() -> Result<String> {
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

fn list_hooks() -> Result<String> {
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
fn sed_replace(arguments: Value) -> Result<String> {
    let args: SedArgs = serde_json::from_value(arguments)?;
    let tool = SedTool::new(sed_config(&args));

    let output = if let Some(file_path) = args.file.as_deref() {
        sed_file_mode_json(&tool, &args, file_path)
    } else if let Some(dir_path) = args.directory.as_deref() {
        sed_directory_mode_json(&tool, &args, dir_path)
    } else {
        json!({
            "success": false,
            "error": "Either 'file' or 'directory' must be specified"
        })
    };
    Ok(serde_json::to_string_pretty(&output)?)
}

fn sed_config(args: &SedArgs) -> SedConfig {
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
    config
}

fn sed_file_mode_json(tool: &SedTool, args: &SedArgs, file_path: &str) -> Value {
    let path = PathBuf::from(file_path);
    match tool.replace_in_file(&args.pattern, &args.replacement, &path) {
        Ok(Some(result)) => json!({
            "success": true,
            "file": result.file,
            "replacements": result.replacements,
            "dry_run": args.dry_run.unwrap_or(false)
        }),
        Ok(None) => json!({
            "success": true,
            "file": file_path,
            "replacements": 0,
            "message": "No matches found"
        }),
        Err(e) => json!({
            "success": false,
            "error": e.to_string()
        }),
    }
}

fn sed_directory_mode_json(tool: &SedTool, args: &SedArgs, dir_path: &str) -> Value {
    let path = PathBuf::from(dir_path);
    match tool.replace_in_directory(&args.pattern, &args.replacement, &path) {
        Ok(report) => sed_directory_json(&report, args.dry_run.unwrap_or(false)),
        Err(e) => json!({
            "success": false,
            "error": e.to_string()
        }),
    }
}

/// Directory mode only succeeds when every file was processed: per-file
/// errors and a timeout leave the tree partially rewritten.
fn sed_directory_json(report: &SedDirectoryReport, dry_run: bool) -> Value {
    let total_replacements: usize = report.results.iter().map(|r| r.replacements).sum();
    let files: Vec<Value> = report
        .results
        .iter()
        .map(|r| json!({"file": r.file, "replacements": r.replacements}))
        .collect();
    let errors: Vec<Value> = report
        .errors
        .iter()
        .map(|e| json!({"file": e.file, "error": e.error}))
        .collect();

    json!({
        "success": report.errors.is_empty() && !report.timed_out,
        "files_modified": report.results.len(),
        "total_replacements": total_replacements,
        "files": files,
        "errors": errors,
        "timed_out": report.timed_out,
        "dry_run": dry_run
    })
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

fn diff_files(arguments: Value) -> Result<String> {
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

fn jq_query(arguments: Value) -> Result<String> {
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

fn http_request(arguments: Value) -> Result<String> {
    let args: HttpArgs = serde_json::from_value(arguments)?;

    let mut config = HttpConfig::default();
    if let Some(ms) = args.timeout_ms {
        config.timeout = Duration::from_millis(ms);
    }

    let tool = HttpTool::new(config);

    let method: HttpMethod = args.method.as_deref().unwrap_or("GET").parse()?;

    let result = tool.request(
        method,
        &args.url,
        args.headers.as_ref(),
        args.body.as_deref(),
    )?;

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

fn file_stats(arguments: Value) -> Result<String> {
    let args: FileStatsArgs = serde_json::from_value(arguments)?;

    let tool = FileStatsTool::new();
    let stats = tool.analyze(&PathBuf::from(&args.directory), args.max_depth)?;

    let file_types: Vec<Value> = stats
        .file_types
        .iter()
        .take(10)
        .map(|ft| {
            json!({
                "extension": ft.extension,
                "count": ft.count,
                "total_lines": ft.total_lines
            })
        })
        .collect();

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

fn git_diff(arguments: Value) -> Result<String> {
    let args: GitDiffArgs = serde_json::from_value(arguments)?;

    let tool = GitTool::new();
    let repo_path = resolve_directory(args.directory);

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

fn git_status(arguments: Value) -> Result<String> {
    let args: GitStatusArgs = serde_json::from_value(arguments)?;

    let tool = GitTool::new();
    let repo_path = resolve_directory(args.directory);

    let files = tool.status(&repo_path)?;
    let branch = tool.current_branch(&repo_path)?;

    let file_list: Vec<Value> = files
        .iter()
        .map(|f| {
            json!({
                "file": f.file,
                "status": f.status
            })
        })
        .collect();

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

fn lsp_diagnostics(arguments: Value) -> Result<String> {
    let args: LspDiagnosticsArgs = serde_json::from_value(arguments)?;

    let mut config = DiagnosticsConfig::default();
    if let Some(include_warnings) = args.include_warnings {
        config.include_warnings = include_warnings;
    }

    let directory = resolve_directory(args.directory);

    let tool = DiagnosticsTool::new(config);
    let diagnostics = tool.get_diagnostics(&directory, args.file.as_deref())?;

    if diagnostics.is_empty() {
        return Ok(
            json!({"status": status::CLEAN, "message": "No diagnostics found. All clean!"})
                .to_string(),
        );
    }

    Ok(serde_json::to_string_pretty(&diagnostics_report_json(
        &diagnostics,
    ))?)
}

fn diagnostics_report_json(diagnostics: &[Diagnostic]) -> Value {
    let errors = count_severity(diagnostics, DiagnosticSeverity::Error);
    let warnings = count_severity(diagnostics, DiagnosticSeverity::Warning);
    let diag_list: Vec<Value> = diagnostics.iter().take(50).map(diagnostic_json).collect();

    json!({
        "status": if errors > 0 { status::ERROR } else if warnings > 0 { status::WARNING } else { status::CLEAN },
        "summary": format!("{} error(s), {} warning(s)", errors, warnings),
        "diagnostics": diag_list,
        "total": diagnostics.len()
    })
}

fn count_severity(diagnostics: &[Diagnostic], severity: DiagnosticSeverity) -> usize {
    diagnostics
        .iter()
        .filter(|d| d.severity == severity)
        .count()
}

fn diagnostic_json(d: &Diagnostic) -> Value {
    json!({
        "file": d.file,
        "line": d.line,
        "column": d.column,
        "severity": format!("{:?}", d.severity).to_lowercase(),
        "message": d.message,
        "source": d.source,
        "code": d.code
    })
}

// ========== AST SEARCH TOOL ==========

#[derive(Deserialize)]
struct AstSearchArgs {
    pattern: String,
    directory: Option<String>,
    lang: Option<String>,
    include: Option<String>,
}

fn ast_search(arguments: Value) -> Result<String> {
    let args: AstSearchArgs = serde_json::from_value(arguments)?;

    let directory = resolve_directory(args.directory);

    let tool = AstTool::new(AstConfig::default());
    let scope = AstScope {
        directory: &directory,
        lang: args.lang.as_deref(),
        include: args.include.as_deref(),
    };
    let matches = tool.search(&args.pattern, scope)?;

    if matches.is_empty() {
        return Ok(
            json!({"matches": [], "total": 0, "message": "No structural matches found."})
                .to_string(),
        );
    }

    let match_list: Vec<Value> = matches
        .iter()
        .take(50)
        .map(|m| {
            json!({
                "file": m.file,
                "line": m.line,
                "column": m.column,
                "content": m.content,
                "matched_text": m.matched_text
            })
        })
        .collect();

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

fn ast_replace(arguments: Value) -> Result<String> {
    let args: AstReplaceArgs = serde_json::from_value(arguments)?;

    let directory = resolve_directory(args.directory);

    let tool = AstTool::new(AstConfig::default());
    let scope = AstScope {
        directory: &directory,
        lang: args.lang.as_deref(),
        include: args.include.as_deref(),
    };
    let result = tool.replace(&args.pattern, &args.rewrite, scope)?;

    Ok(serde_json::to_string_pretty(&json!({
        "success": result.success,
        "message": result.message,
        "pattern": args.pattern,
        "rewrite": args.rewrite
    }))?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn http_rejects_unknown_methods_instead_of_sending_get() {
        let result = execute_tool(
            tool::HTTP,
            json!({"url": "http://127.0.0.1:9/", "method": "FETCH"}),
        )
        .await;
        let error = result.expect_err("unknown method must be rejected");
        assert!(error.to_string().contains("FETCH"));
    }

    #[tokio::test]
    async fn sed_directory_mode_is_not_successful_after_a_timeout() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "foo\n").unwrap();

        let output = execute_tool(
            tool::SED_REPLACE,
            json!({
                "pattern": "foo",
                "replacement": "bar",
                "directory": dir.path(),
                "timeout_ms": 0
            }),
        )
        .await
        .unwrap();
        let report: Value = serde_json::from_str(&output).unwrap();

        assert_eq!(report["success"], false);
        assert_eq!(report["timed_out"], true);
        assert_eq!(report["errors"], json!([]));
    }

    #[test]
    fn diagnostics_report_counts_errors_and_warnings() {
        let diagnostic = |severity| Diagnostic {
            file: "a.ts".to_string(),
            line: 1,
            column: 2,
            severity,
            message: "m".to_string(),
            source: None,
            code: None,
        };
        let diagnostics = [
            diagnostic(DiagnosticSeverity::Warning),
            diagnostic(DiagnosticSeverity::Error),
            diagnostic(DiagnosticSeverity::Hint),
        ];

        let value = diagnostics_report_json(&diagnostics);

        assert_eq!(value["status"], status::ERROR);
        assert_eq!(value["summary"], "1 error(s), 1 warning(s)");
        assert_eq!(value["diagnostics"][0]["severity"], "warning");
        assert_eq!(value["total"], 3);
        assert_eq!(
            diagnostics_report_json(&diagnostics[..1])["status"],
            status::WARNING
        );
    }

    #[test]
    fn sed_directory_json_reports_per_file_errors() {
        let report = SedDirectoryReport {
            errors: vec![orchestrator_core::tools::sed::SedFileError {
                file: "locked.txt".to_string(),
                error: "permission denied".to_string(),
            }],
            ..SedDirectoryReport::default()
        };

        let value = sed_directory_json(&report, false);

        assert_eq!(value["success"], false);
        assert_eq!(value["errors"][0]["file"], "locked.txt");
    }
}
