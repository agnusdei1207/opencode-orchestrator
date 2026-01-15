import { tool } from "@opencode-ai/plugin";
import { callRustTool } from "./rust.js";

/**
 * Grep search tool - finds patterns in code
 * Used by Builder and Inspector for codebase analysis
 */
export const grepSearchTool = (directory: string) => tool({
    description: "Search code patterns using regex. Returns matching lines with file paths and line numbers.",
    args: {
        pattern: tool.schema.string().describe("Regex pattern to search for"),
        dir: tool.schema.string().optional().describe("Directory to search (defaults to project root)"),
    },
    async execute(args) {
        return callRustTool("grep_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
        });
    },
});

/**
 * Glob search tool - finds files by pattern
 * Used by Builder and Recorder for file discovery
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
 * Multi-grep (mgrep) tool - search multiple patterns in parallel
 * High-performance parallel search powered by Rust
 * 
 * Use cases:
 * - Find all usages of multiple functions at once
 * - Search for related patterns (imports, exports, usages)
 * - Codebase-wide refactoring analysis
 */
export const mgrepTool = (directory: string) => tool({
    description: `Search multiple patterns in parallel (high-performance).

<purpose>
Search for multiple regex patterns simultaneously using Rust's parallel execution.
Much faster than running grep multiple times sequentially.
</purpose>

<examples>
- patterns: ["useState", "useEffect", "useContext"] → Find all React hooks usage
- patterns: ["TODO", "FIXME", "HACK"] → Find all code annotations
- patterns: ["import.*lodash", "require.*lodash"] → Find all lodash imports
</examples>

<output>
Returns matches grouped by pattern, with file paths and line numbers.
</output>`,
    args: {
        patterns: tool.schema.array(tool.schema.string()).describe("Array of regex patterns to search for"),
        dir: tool.schema.string().optional().describe("Directory to search (defaults to project root)"),
        max_results_per_pattern: tool.schema.number().optional().describe("Max results per pattern (default: 50)"),
    },
    async execute(args) {
        return callRustTool("mgrep", {
            patterns: args.patterns,
            directory: args.dir || directory,
            max_results_per_pattern: args.max_results_per_pattern || 50,
        });
    },
});

