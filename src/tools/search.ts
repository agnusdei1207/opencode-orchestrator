import { tool } from "@opencode-ai/plugin";
import { callRustTool } from "./rust.js";

/**
 * Grep search tool - finds patterns in code
 * Used by Worker and Reviewer for codebase analysis
 */
export const grepSearchTool = (directory: string) => tool({
    description: "Search code patterns using regex. Returns matching lines with file paths and line numbers.",
    args: {
        pattern: tool.schema.string().describe("Regex pattern to search for"),
        dir: tool.schema.string().optional().describe("Directory to search (defaults to project root)"),
        max_results: tool.schema.number().optional().describe("Max results (default: 100)"),
        timeout_ms: tool.schema.number().optional().describe("Timeout in milliseconds (default: 30000)"),
    },
    async execute(args) {
        return callRustTool("grep_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
            max_results: args.max_results,
            timeout_ms: args.timeout_ms,
        });
    },
});

/**
 * Glob search tool - finds files by pattern
 * Used by Worker and Reviewer for file discovery
 */
export const globSearchTool = (directory: string) => tool({
    description: "Find files matching a glob pattern. Returns list of file paths.",
    args: {
        pattern: tool.schema.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.md')"),
        dir: tool.schema.string().optional().describe("Directory to search (defaults to project root)"),
    },
    async execute(args) {
        return callRustTool("glob_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
        });
    },
});

/**
 * Multi-grep (mgrep) tool - search multiple patterns
 * Runs grep for each pattern and combines results
 */
export const mgrepTool = (directory: string) => tool({
    description: `Search multiple patterns (runs grep for each pattern).`,
    args: {
        patterns: tool.schema.array(tool.schema.string()).describe("Array of regex patterns"),
        dir: tool.schema.string().optional().describe("Directory (defaults to project root)"),
        max_results_per_pattern: tool.schema.number().optional().describe("Max results per pattern (default: 50)"),
        timeout_ms: tool.schema.number().optional().describe("Timeout in milliseconds (default: 60000)"),
    },
    async execute(args) {
        return callRustTool("mgrep", {
            patterns: args.patterns,
            directory: args.dir || directory,
            max_results_per_pattern: args.max_results_per_pattern,
            timeout_ms: args.timeout_ms,
        });
    },
});

/**
 * Sed replace tool - find and replace patterns in files
 * Used for bulk code migrations and refactoring
 */
export const sedReplaceTool = (directory: string) => tool({
    description: `Find and replace patterns in files (sed-like). Supports regex. Use dry_run=true to preview changes.`,
    args: {
        pattern: tool.schema.string().describe("Regex pattern to find"),
        replacement: tool.schema.string().describe("Replacement string"),
        file: tool.schema.string().optional().describe("Single file to modify"),
        dir: tool.schema.string().optional().describe("Directory to search (modifies all matching files)"),
        dry_run: tool.schema.boolean().optional().describe("Preview changes without modifying files (default: false)"),
        backup: tool.schema.boolean().optional().describe("Create .bak backup before modifying (default: false)"),
        timeout_ms: tool.schema.number().optional().describe("Timeout in milliseconds"),
    },
    async execute(args) {
        return callRustTool("sed_replace", {
            pattern: args.pattern,
            replacement: args.replacement,
            file: args.file,
            directory: args.dir || (args.file ? undefined : directory),
            dry_run: args.dry_run,
            backup: args.backup,
            timeout_ms: args.timeout_ms,
        });
    },
});

/**
 * Diff tool - compare files or strings
 */
export const diffTool = () => tool({
    description: `Compare two files or strings and show differences.`,
    args: {
        file1: tool.schema.string().optional().describe("First file to compare"),
        file2: tool.schema.string().optional().describe("Second file to compare"),
        content1: tool.schema.string().optional().describe("First string to compare"),
        content2: tool.schema.string().optional().describe("Second string to compare"),
        ignore_whitespace: tool.schema.boolean().optional().describe("Ignore whitespace differences"),
    },
    async execute(args) {
        return callRustTool("diff", args);
    },
});

/**
 * JQ tool - JSON query and manipulation
 */
export const jqTool = () => tool({
    description: `Query and manipulate JSON using jq expressions.`,
    args: {
        json_input: tool.schema.string().optional().describe("JSON string to query"),
        file: tool.schema.string().optional().describe("JSON file to query"),
        expression: tool.schema.string().describe("jq expression (e.g., '.foo.bar', '.[] | select(.x > 1)')"),
        raw_output: tool.schema.boolean().optional().describe("Raw output (no JSON encoding for strings)"),
    },
    async execute(args) {
        return callRustTool("jq", args);
    },
});

/**
 * HTTP tool - make HTTP requests (curl-like)
 */
export const httpTool = () => tool({
    description: `Make HTTP requests (GET, POST, PUT, DELETE, etc).`,
    args: {
        url: tool.schema.string().describe("URL to request"),
        method: tool.schema.string().optional().describe("HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD)"),
        headers: tool.schema.object({}).optional().describe("Request headers as JSON object"),
        body: tool.schema.string().optional().describe("Request body"),
        timeout_ms: tool.schema.number().optional().describe("Request timeout in milliseconds"),
    },
    async execute(args) {
        return callRustTool("http", args);
    },
});

/**
 * File stats tool - analyze directory/file statistics
 */
export const fileStatsTool = (directory: string) => tool({
    description: `Analyze file/directory statistics (file counts, sizes, line counts, etc).`,
    args: {
        dir: tool.schema.string().optional().describe("Directory to analyze (defaults to project root)"),
        max_depth: tool.schema.number().optional().describe("Maximum directory depth to analyze"),
    },
    async execute(args) {
        return callRustTool("file_stats", {
            directory: args.dir || directory,
            max_depth: args.max_depth,
        });
    },
});

/**
 * Git diff tool - show uncommitted changes
 */
export const gitDiffTool = (directory: string) => tool({
    description: `Show git diff of uncommitted changes.`,
    args: {
        dir: tool.schema.string().optional().describe("Repository directory (defaults to project root)"),
        staged_only: tool.schema.boolean().optional().describe("Show only staged changes"),
    },
    async execute(args) {
        return callRustTool("git_diff", {
            directory: args.dir || directory,
            staged_only: args.staged_only,
        });
    },
});

/**
 * Git status tool - show repository status
 */
export const gitStatusTool = (directory: string) => tool({
    description: `Show git status (modified, added, deleted files).`,
    args: {
        dir: tool.schema.string().optional().describe("Repository directory (defaults to project root)"),
    },
    async execute(args) {
        return callRustTool("git_status", {
            directory: args.dir || directory,
        });
    },
});
