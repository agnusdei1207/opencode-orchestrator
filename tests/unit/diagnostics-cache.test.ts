import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lspDiagnosticsTool } from "../../src/tools/lsp/index";
import { callRustTool } from "../../src/tools/rust";

vi.mock("../../src/tools/rust", () => ({ callRustTool: vi.fn() }));
let directory: string;
beforeEach(() => {
    vi.resetAllMocks();
    directory = mkdtempSync(path.join(tmpdir(), "oco-diagnostics-"));
    writeFileSync(path.join(directory, "index.ts"), "const value = 1;");
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("Live diagnostics boundary", () => {
    it("rechecks project diagnostics after editing a file without changing directory entries", async () => {
        vi.mocked(callRustTool).mockResolvedValueOnce("clean").mockResolvedValueOnce("type error");
        const diagnostics = lspDiagnosticsTool(directory);
        expect(await diagnostics.execute({}, {} as never)).toBe("clean");
        writeFileSync(path.join(directory, "index.ts"), 'const value: number = "broken";');
        expect(await diagnostics.execute({}, {} as never)).toBe("type error");
    });

    it("honors changed warning options on successive checks of the same file", async () => {
        vi.mocked(callRustTool).mockImplementation(async (_name, args) => args.include_warnings ? "warning" : "clean");
        const diagnostics = lspDiagnosticsTool(directory);
        expect(await diagnostics.execute({ file: "index.ts", include_warnings: false }, {} as never)).toBe("clean");
        expect(await diagnostics.execute({ file: "index.ts", include_warnings: true }, {} as never)).toBe("warning");
    });

    it("retries an explicit diagnostics request after tool availability changes", async () => {
        vi.mocked(callRustTool).mockResolvedValueOnce('Error: compiler unavailable').mockResolvedValueOnce("clean");
        const diagnostics = lspDiagnosticsTool(directory);
        expect(await diagnostics.execute({}, {} as never)).toBe('Error: compiler unavailable');
        expect(await diagnostics.execute({}, {} as never)).toBe("clean");
    });
});
