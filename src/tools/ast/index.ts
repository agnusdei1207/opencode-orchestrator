/**
 * AST Tools Index
 * 
 * Re-exports AST search/replace tools using Rust backend.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { TOOL_NAMES } from "../../shared/index.js";
import { callRustTool } from "../rust.js";

/**
 * AST Search Tool
 * Uses Rust backend to run ast-grep for structural code search.
 */
export const astSearchTool = (directory: string): ToolDefinition => tool({
    description: `Perform structural search using ast-grep.
Find code patterns based on syntax (e.g., 'function $NAME($$$ARGS) { $$$BODY }').

<patterns>
- $NAME: Matches a single identifier
- $$$ARGS: Matches multiple arguments/elements
- Use '___' for wildcards
</patterns>`,
    args: {
        pattern: tool.schema.string().describe("Structural pattern to search for"),
        lang: tool.schema.string().optional().describe("Language (typescript, javascript, json, etc. default: typescript)"),
        include: tool.schema.string().optional().describe("Glob pattern for files to include"),
    },
    async execute(args) {
        return callRustTool(TOOL_NAMES.AST_SEARCH, {
            pattern: args.pattern,
            directory,
            lang: args.lang,
            include: args.include,
        });
    },
});

/**
 * AST Replace Tool
 * Uses Rust backend to run ast-grep for structural code replacement.
 */
export const astReplaceTool = (directory: string): ToolDefinition => tool({
    description: `Perform structural search and replace using ast-grep.
Safely refactor code across files using syntax patterns.`,
    args: {
        pattern: tool.schema.string().describe("Pattern to find"),
        rewrite: tool.schema.string().describe("Replacement pattern (use $ placeholders)"),
        lang: tool.schema.string().optional().describe("Language (typescript, javascript, etc. default: typescript)"),
        include: tool.schema.string().optional().describe("Glob pattern for files"),
    },
    async execute(args) {
        return callRustTool(TOOL_NAMES.AST_REPLACE, {
            pattern: args.pattern,
            rewrite: args.rewrite,
            directory,
            lang: args.lang,
            include: args.include,
        });
    },
});
