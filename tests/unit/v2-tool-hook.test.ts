import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { setupV2 } from "../../src/v2/setup.js";

vi.mock("../../src/plugin-handlers/tool-execute-handler.js", () => ({
    createToolExecuteAfterHandler: () => async (_input: unknown, output: { output: string }) => {
        output.output += " [checked]";
    },
}));

function createHost(directory: string) {
    const hooks = new Map<string, (input: unknown) => Promise<void>>();
    const register = async () => ({ dispose: async () => {} });
    const context = {
        location: { directory, project: { directory } },
        options: {},
        agent: { list: async () => [], transform: register },
        session: { hook: register },
        tool: {
            hook: async (name: string, callback: (input: unknown) => Promise<void>) => {
                hooks.set(name, callback);
                return register();
            },
            transform: register,
        },
        command: { transform: register },
        event: { subscribe: async function* () {} },
    } as unknown as Plugin.Context;
    return { context, hooks };
}

describe("OpenCode 2 tool hook", () => {
    it("appends post-tool text without serializing the result wrapper", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-tool-hook-"));
        const { context, hooks } = createHost(directory);
        const cleanup = await setupV2(context);
        try {
            const result = { content: "ok" };
            await hooks.get("execute.after")?.({
                sessionID: "session-1", tool: "fixture", id: "call-1", input: {}, status: "completed", result,
            });
            expect(result.content).toBe("ok [checked]");
        } finally {
            await cleanup();
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it("preserves file content when a post-tool hook adds text", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-tool-hook-"));
        const { context, hooks } = createHost(directory);
        const cleanup = await setupV2(context);
        try {
            const result = { content: [
                { type: "text", text: "ok" },
                { type: "file", uri: "file:///tmp/report.txt", mime: "text/plain", name: "report.txt" },
            ] };
            await hooks.get("execute.after")?.({
                sessionID: "session-1", tool: "fixture", id: "call-1", input: {}, status: "completed", result,
            });
            expect(result.content).toEqual([
                { type: "text", text: "ok [checked]" },
                { type: "file", uri: "file:///tmp/report.txt", mime: "text/plain", name: "report.txt" },
            ]);
        } finally {
            await cleanup();
            rmSync(directory, { recursive: true, force: true });
        }
    });
});
