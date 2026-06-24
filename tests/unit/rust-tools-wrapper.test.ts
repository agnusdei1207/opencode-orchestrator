/**
 * Rust Tools Wrapper Tests
 * 
 * Verifies that the TypeScript tool definitions correctly delegate 
 * to the Rust backend.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { lspDiagnosticsTool } from "../../src/tools/lsp/index.js";
import { astSearchTool, astReplaceTool } from "../../src/tools/ast/index.js";
import {
    diffTool,
    fileStatsTool,
    gitDiffTool,
    gitStatusTool,
    grepSearchTool,
    globSearchTool,
    httpTool,
    jqTool,
    mgrepTool,
    sedReplaceTool,
} from "../../src/tools/search.js";
import { TOOL_NAMES } from "../../src/shared/index.js";

// Mock callRustTool
vi.mock("../../src/tools/rust.js", () => ({
    callRustTool: vi.fn(async (toolName, args) => {
        return JSON.stringify({ tool: toolName, args, status: "ok" });
    }),
}));

// Mock @opencode-ai/plugin to avoid ESM resolution issues in vitest
vi.mock("@opencode-ai/plugin", () => {
    const mockSchema = {
        string: () => ({ optional: () => ({ describe: () => mockSchema }), describe: () => mockSchema }),
        boolean: () => ({ optional: () => ({ describe: () => mockSchema }), describe: () => mockSchema }),
        number: () => ({ optional: () => ({ describe: () => mockSchema }), describe: () => mockSchema }),
        array: () => ({ optional: () => ({ describe: () => mockSchema }), describe: () => mockSchema }),
        enum: () => ({ optional: () => ({ describe: () => mockSchema }), describe: () => mockSchema }),
        object: () => ({ optional: () => ({ describe: () => mockSchema }), describe: () => mockSchema }),
    };
    const mockTool = vi.fn((config) => config) as any;
    mockTool.schema = mockSchema;
    return { tool: mockTool };
});

import { callRustTool } from "../../src/tools/rust.js";

describe("Rust Tool Wrappers", () => {
    const testDir = "/test/dir";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("LSP Tools", () => {
        it("should call Rust lsp_diagnostics", async () => {
            const args = { file: "src/test.ts" };
            await lspDiagnosticsTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.LSP_DIAGNOSTICS, expect.objectContaining({
                directory: testDir,
                file: "src/test.ts"
            }));
        });
    });

    describe("AST Tools", () => {
        it("should call Rust ast_search", async () => {
            const args = { pattern: "const $X = 1", lang: "typescript" };
            await astSearchTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.AST_SEARCH, expect.objectContaining({
                directory: testDir,
                pattern: "const $X = 1"
            }));
        });

        it("should call Rust ast_replace", async () => {
            const args = { pattern: "const $X = 1", rewrite: "const $X = 2" };
            await astReplaceTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.AST_REPLACE, expect.objectContaining({
                directory: testDir,
                pattern: "const $X = 1",
                rewrite: "const $X = 2"
            }));
        });
    });

    describe("Search & File Tools", () => {
        it("should call Rust grep_search", async () => {
            const args = { pattern: "TODO" };
            await grepSearchTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.GREP_SEARCH, expect.objectContaining({
                directory: testDir,
                pattern: "TODO"
            }));
        });

        it("should call Rust glob_search", async () => {
            const args = { pattern: "src/**/*.ts" };
            await globSearchTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.GLOB_SEARCH, expect.objectContaining({
                directory: testDir,
                pattern: "src/**/*.ts"
            }));
        });

        it("should call Rust mgrep", async () => {
            const args = { patterns: ["TODO", "FIXME"], max_results_per_pattern: 3 };
            await mgrepTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.MGREP, expect.objectContaining({
                directory: testDir,
                patterns: ["TODO", "FIXME"],
                max_results_per_pattern: 3
            }));
        });

        it("should call Rust sed_replace", async () => {
            const args = { pattern: "old", replacement: "new", file: "src/test.ts" };
            await sedReplaceTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.SED_REPLACE, expect.objectContaining({
                pattern: "old",
                replacement: "new",
                file: "src/test.ts"
            }));
        });

        it("should call Rust diff", async () => {
            const args = { content1: "a", content2: "b" };
            await diffTool().execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.DIFF, args);
        });

        it("should call Rust jq", async () => {
            const args = { json_input: "{\"a\":1}", expression: ".a" };
            await jqTool().execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.JQ, args);
        });

        it("should call Rust file_stats", async () => {
            const args = { max_depth: 2 };
            await fileStatsTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.FILE_STATS, expect.objectContaining({
                directory: testDir,
                max_depth: 2
            }));
        });

        it("should call Rust git_diff", async () => {
            await gitDiffTool(testDir).execute({ staged_only: true }, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.GIT_DIFF, expect.objectContaining({
                directory: testDir,
                staged_only: true
            }));
        });

        it("should call Rust git_status", async () => {
            await gitStatusTool(testDir).execute({}, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.GIT_STATUS, expect.objectContaining({
                directory: testDir
            }));
        });
    });

    describe("HTTP Tools", () => {
        it("should call Rust http", async () => {
            const args = { url: "https://example.com" };
            await httpTool().execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith(TOOL_NAMES.HTTP, expect.objectContaining({
                url: "https://example.com"
            }));
        });
    });
});
