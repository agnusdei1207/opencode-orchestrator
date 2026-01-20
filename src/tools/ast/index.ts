/**
 * AST Tools Index
 * 
 * Re-exports AST search/replace tools using Rust backend.
 */

import { tool } from "@opencode-ai/plugin";
import { callRustTool } from "../rust.js";

/**
 * AST Search Tool
 * Uses Rust backend to run ast-grep for structural code search.
 */
export const astSearchTool = (directory: string) => tool({
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
        return callRustTool("ast_search", {
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
export const astReplaceTool = (directory: string) => tool({
    description: `Perform structural search and replace using ast-grep.
Safely refactor code across files using syntax patterns.`,
    args: {
        pattern: tool.schema.string().describe("Pattern to find"),
        rewrite: tool.schema.string().describe("Replacement pattern (use $ placeholders)"),
        lang: tool.schema.string().optional().describe("Language (typescript, javascript, etc. default: typescript)"),
        include: tool.schema.string().optional().describe("Glob pattern for files"),
    },
    async execute(args) {
        return callRustTool("ast_replace", {
            pattern: args.pattern,
            rewrite: args.rewrite,
            directory,
            lang: args.lang,
            include: args.include,
        });
    },
});
