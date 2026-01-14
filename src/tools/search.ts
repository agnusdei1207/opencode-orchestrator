import { tool } from "@opencode-ai/plugin";
import { callRustTool } from "./rust.js";

export const grepSearchTool = (directory: string) => tool({
    description: "Search code patterns",
    args: {
        pattern: tool.schema.string().describe("Regex pattern"),
        dir: tool.schema.string().optional().describe("Directory"),
    },
    async execute(args) {
        return callRustTool("grep_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
        });
    },
});

export const globSearchTool = (directory: string) => tool({
    description: "Find files by pattern",
    args: {
        pattern: tool.schema.string().describe("Glob pattern"),
        dir: tool.schema.string().optional().describe("Directory"),
    },
    async execute(args) {
        return callRustTool("glob_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
        });
    },
});
