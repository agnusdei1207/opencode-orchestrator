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
    },
    async execute(args) {
        const results: Record<string, string> = {};
        const dir = args.dir || directory;

        for (const pattern of args.patterns) {
            const result = await callRustTool("grep_search", { pattern, directory: dir });
            results[pattern] = result;
        }

        return JSON.stringify(results, null, 2);
    },
});

