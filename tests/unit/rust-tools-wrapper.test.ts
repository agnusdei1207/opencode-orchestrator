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
    grepSearchTool,
    globSearchTool,
    mgrepTool,
    fileStatsTool,
    gitDiffTool,
    gitStatusTool,
    httpTool
} from "../../src/tools/search.js";

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

            expect(callRustTool).toHaveBeenCalledWith("lsp_diagnostics", expect.objectContaining({
                directory: testDir,
                file: "src/test.ts"
            }));
        });
    });

    describe("AST Tools", () => {
        it("should call Rust ast_search", async () => {
            const args = { pattern: "const $X = 1", lang: "typescript" };
            await astSearchTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith("ast_search", expect.objectContaining({
                directory: testDir,
                pattern: "const $X = 1"
            }));
        });
    });

    describe("Search & File Tools", () => {
        it("should call Rust grep_search", async () => {
            const args = { pattern: "TODO" };
            await grepSearchTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith("grep_search", expect.objectContaining({
                directory: testDir,
                pattern: "TODO"
            }));
        });

        it("should call Rust file_stats", async () => {
            const args = { max_depth: 2 };
            await fileStatsTool(testDir).execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith("file_stats", expect.objectContaining({
                directory: testDir,
                max_depth: 2
            }));
        });

        it("should call Rust git_status", async () => {
            await gitStatusTool(testDir).execute({}, {} as any);

            expect(callRustTool).toHaveBeenCalledWith("git_status", expect.objectContaining({
                directory: testDir
            }));
        });
    });

    describe("HTTP Tools", () => {
        it("should call Rust http", async () => {
            const args = { url: "https://example.com" };
            await httpTool().execute(args, {} as any);

            expect(callRustTool).toHaveBeenCalledWith("http", expect.objectContaining({
                url: "https://example.com"
            }));
        });
    });
});
