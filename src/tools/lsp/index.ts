/**
 * LSP Tools Index
 * 
 * Re-exports LSP diagnostics tool using Rust backend.
 */

import { tool } from "@opencode-ai/plugin";
import { callRustTool } from "../rust.js";
import { diagnosticsCache } from "./diagnostics-cache.js";

/**
 * LSP Diagnostics Tool
 * Uses Rust backend to run tsc and eslint.
 */
export const lspDiagnosticsTool = (directory: string) => tool({
    description: `Get LSP diagnostics (errors/warnings) for files.

Use this BEFORE marking a task complete to verify code quality.
Runs TypeScript compiler and/or ESLint to find issues.

<when_to_use>
- After editing files, before claiming "done"
- Before marking todo items complete
- To check for type errors without full build
</when_to_use>`,
    args: {
        file: tool.schema.string().optional().describe("File path to check (or '*' for all files)"),
        include_warnings: tool.schema.boolean().optional().describe("Include warnings (default: true)"),
    },
    async execute(args) {
        // Try cache first
        const cached = await diagnosticsCache.get(directory, args.file);
        if (cached) return cached;

        // Call Rust tool
        const result = await callRustTool("lsp_diagnostics", {
            directory,
            file: args.file,
            include_warnings: args.include_warnings,
        });

        // Store in cache if successful
        if (result) {
            await diagnosticsCache.set(directory, args.file, result);
        }

        return result;
    },
});
