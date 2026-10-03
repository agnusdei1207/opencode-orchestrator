//! Tool implementations for the orchestrator CLI

use anyhow::Result;
use orchestrator_core::hooks::Hook;
use orchestrator_core::tools::{
    AstTool, DiagnosticsTool, DiffTool, FileStatsTool, GitTool, GlobTool, GrepTool, HttpTool,
    JqTool, MgrepTool, SedTool, ast::AstConfig, ast::AstScope, diff::DiffConfig, glob::GlobConfig,
    grep::GrepConfig, http::HttpConfig, http::HttpMethod, http::HttpRequest, jq::JqConfig,
    lsp::Diagnostic, lsp::DiagnosticSeverity, lsp::DiagnosticsConfig, mgrep::MgrepConfig,
    mgrep::MgrepMatch, mgrep::MgrepResult, sed::SedConfig, sed::SedDirectoryReport,
};

use orchestrator_core::constants::{agent, status, tool};
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

/// Upper bound for `max_results` of grep and glob and for mgrep's
/// `max_results_per_pattern`, keeping a single reply bounded.
const MAX_SEARCH_RESULTS: usize = 1000;
/// `max_results` of grep and glob when the caller gives none.
const DEFAULT_SEARCH_RESULTS: usize = 100;

/// Tools default to the process working directory when none is given.
fn resolve_directory(directory: Option<String>) -> PathBuf {
    directory
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
}

/// A `timeout_ms` of 0 (or none) keeps the tool's default deadline instead of
/// expiring before the first file is read.
fn timeout_or_default(timeout_ms: Option<u64>, default: Duration) -> Duration {
    timeout_ms
        .filter(|ms| *ms > 0)
        .map_or(default, Duration::from_millis)
}

/// The requested result limit (0 or none means `default`), capped at
/// [`MAX_SEARCH_RESULTS`].
fn result_limit(requested: Option<usize>, default: usize) -> usize {
    requested
        .filter(|limit| *limit > 0)
        .unwrap_or(default)
        .min(MAX_SEARCH_RESULTS)
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
    config.timeout = timeout_or_default(args.timeout_ms, config.timeout);
    config.max_results = result_limit(args.max_results, DEFAULT_SEARCH_RESULTS);
    let limit = config.max_results;

    let search_dir = resolve_directory(args.directory);

    let tool = GrepTool::new(config);
    let found = tool.search(&args.pattern, &search_dir)?;

    let matches: Vec<Value> = found
        .matches
        .iter()
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
        "total": found.matches.len(),
        "truncated": found.matches.len() >= limit,
        "timed_out": found.timed_out
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
    config.timeout = timeout_or_default(args.timeout_ms, config.timeout);
    config.max_results_per_pattern =
        result_limit(args.max_results_per_pattern, config.max_results_per_pattern);
    let limit = config.max_results_per_pattern;

    let search_dir = resolve_directory(args.directory);

    let tool = MgrepTool::new(config);
    let result = tool.search(&args.patterns, &search_dir)?;

    Ok(serde_json::to_string_pretty(&mgrep_json(
        &result,
        args.patterns.len(),
        limit,
    ))?)
}

fn mgrep_json(result: &MgrepResult, requested: usize, limit: usize) -> Value {
    let all_results: Vec<Value> = result
        .results
        .iter()
        .map(|(pattern, matches)| mgrep_pattern_json(pattern, matches, limit))
        .collect();
    let invalid: Vec<Value> = result
        .invalid_patterns
        .iter()
        .map(|p| json!({"pattern": p.pattern, "error": p.error}))
        .collect();

    json!({
        "results": all_results,
        "patterns_searched": requested - invalid.len(),
        "invalid_patterns": invalid,
        "timed_out": result.timed_out
    })
}

fn mgrep_pattern_json(pattern: &str, matches: &[MgrepMatch], limit: usize) -> Value {
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
        "total": matches.len(),
        "truncated": matches.len() >= limit
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

    let limit = result_limit(args.max_results, DEFAULT_SEARCH_RESULTS);
    let config = GlobConfig {
        max_results: limit,
        ..GlobConfig::default()
    };

    let search_dir = resolve_directory(args.directory);

    let tool = GlobTool::new(config);
    let found = tool.find(&args.pattern, &search_dir)?;

    let files: Vec<String> = found
        .paths
        .iter()
        .map(|p| p.display().to_string())
        .collect();

    Ok(serde_json::to_string_pretty(&json!({
        "files": files,
        "total": found.paths.len(),
        "truncated": found.paths.len() >= limit,
        "timed_out": found.timed_out
    }))?)
}

/// List all available agents (4-agent architecture)
fn list_agents() -> Result<String> {
    let agents: Vec<Value> = agent::ROLES
        .iter()
        .map(|(id, description)| json!({"id": id, "description": description}))
        .collect();

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

    let result = tool.request(HttpRequest {
        method,
        url: &args.url,
        headers: args.headers.as_ref(),
        body: args.body.as_deref(),
    })?;

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

    let tool = FileStatsTool::default();
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
        "largest_files": stats.largest_files,
        "timed_out": stats.timed_out
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

    async fn run_json(name: &str, arguments: Value) -> Value {
        let output = execute_tool(name, arguments).await.unwrap();
        serde_json::from_str(&output).unwrap()
    }

    fn write_lines(dir: &std::path::Path, name: &str, count: usize) {
        std::fs::write(dir.join(name), "needle\n".repeat(count)).unwrap();
    }

    #[tokio::test]
    async fn grep_honors_max_results_above_the_old_hard_cap() {
        let dir = tempfile::tempdir().unwrap();
        write_lines(dir.path(), "a.txt", 150);

        let report = run_json(
            tool::GREP_SEARCH,
            json!({"pattern": "needle", "directory": dir.path(), "max_results": 150}),
        )
        .await;

        assert_eq!(report["matches"].as_array().unwrap().len(), 150);
        assert_eq!(report["truncated"], true);
        assert_eq!(report["timed_out"], false);
    }

    #[tokio::test]
    async fn grep_caps_max_results_and_flags_truncation() {
        let dir = tempfile::tempdir().unwrap();
        write_lines(dir.path(), "a.txt", MAX_SEARCH_RESULTS + 5);

        let report = run_json(
            tool::GREP_SEARCH,
            json!({"pattern": "needle", "directory": dir.path(), "max_results": 1_000_000}),
        )
        .await;

        assert_eq!(report["total"], MAX_SEARCH_RESULTS);
        assert_eq!(report["truncated"], true);
    }

    #[tokio::test]
    async fn zero_timeouts_use_the_default_instead_of_returning_nothing() {
        let dir = tempfile::tempdir().unwrap();
        write_lines(dir.path(), "a.txt", 1);
        let base = json!({"directory": dir.path(), "timeout_ms": 0});

        let mut grep = base.clone();
        grep["pattern"] = json!("needle");
        let mut mgrep = base.clone();
        mgrep["patterns"] = json!(["needle"]);
        let grep = run_json(tool::GREP_SEARCH, grep).await;
        let mgrep = run_json(tool::MGREP, mgrep).await;

        assert_eq!(grep["total"], 1);
        assert_eq!(grep["timed_out"], false);
        assert_eq!(mgrep["results"][0]["total"], 1);
        assert_eq!(mgrep["timed_out"], false);
    }

    #[tokio::test]
    async fn mgrep_reports_invalid_patterns_instead_of_dropping_them() {
        let dir = tempfile::tempdir().unwrap();
        write_lines(dir.path(), "a.txt", 1);

        let report = run_json(
            tool::MGREP,
            json!({"patterns": ["needle", "("], "directory": dir.path()}),
        )
        .await;

        assert_eq!(report["patterns_searched"], 1);
        assert_eq!(report["invalid_patterns"][0]["pattern"], "(");
        assert!(report["invalid_patterns"][0]["error"].is_string());
    }

    #[tokio::test]
    async fn glob_honors_max_results_and_flags_truncation() {
        let dir = tempfile::tempdir().unwrap();
        for index in 0..120 {
            std::fs::write(dir.path().join(format!("f{index}.rs")), "").unwrap();
        }

        let limited = run_json(
            tool::GLOB_SEARCH,
            json!({"pattern": "*.rs", "directory": dir.path(), "max_results": 110}),
        )
        .await;
        let all = run_json(
            tool::GLOB_SEARCH,
            json!({"pattern": "*.rs", "directory": dir.path(), "max_results": 500}),
        )
        .await;

        assert_eq!(limited["files"].as_array().unwrap().len(), 110);
        assert_eq!(limited["truncated"], true);
        assert_eq!(all["total"], 120);
        assert_eq!(all["truncated"], false);
        assert_eq!(all["timed_out"], false);
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
