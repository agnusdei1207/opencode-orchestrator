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
