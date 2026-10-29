import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { describe, expect, it } from "vitest";
import OrchestratorPlugin from "../../src/index.js";
import { readLoopState, writeLoopState } from "../../src/core/loop/mission-loop.js";

const SESSION = "ses_cache_owner";
type Hook = (input: unknown) => Promise<void>;

describe("mission prompt cache compatibility (issue #57)", () => {
    it("keeps system and conversation prefix identical as all runtime fields change", async () => {
        const host = await createHost();
        try {
            await host.prompt("/task Build caching fix");
            const request = host.request();
            const system = JSON.stringify(request.system);
            const history = JSON.stringify(request.messages);
            const count = request.messages.length;
            await host.transform(request);
            expect(JSON.stringify(request.system)).toBe(system);
            expect(JSON.stringify(request.messages.slice(0, count))).toBe(history);
            expect(JSON.stringify(request.messages.at(-1))).toContain("Steps executed: 1");
            expect(JSON.stringify(request.messages.at(-1))).toContain("Build caching fix");
            await host.step();
            const state = readLoopState(host.directory)!;
            writeLoopState(host.directory, { ...state, iteration: 9, lastVerificationSummary: "all tests pass" });
            writeFileSync(path.join(host.directory, ".opencode/docs/brain/scratchpad.md"), "Current scratchpad");
            await host.transform(request);
            expect(request.messages.length).toBe(count + 1);
            expect(JSON.stringify(request.system)).toBe(system);
            expect(JSON.stringify(request.messages.slice(0, count))).toBe(history);
            const tail = JSON.stringify(request.messages.at(-1));
            for (const value of ["Steps executed: 2", "Iteration 9", "all tests pass", "Current scratchpad"]) {
                expect(tail).toContain(value);
            }
        } finally { await host.dispose(); }
    });

    it("adds fresh context to growing outgoing copies without rewriting stored history", async () => {
        const host = await createHost();
        try {
            await host.prompt("/task Build caching fix");
            const stored = host.request();
            const original = structuredClone(stored);
            const first = structuredClone(stored);
            await host.transform(first);
            expect(stored).toEqual(original);
            await host.step();
            const second = structuredClone(stored);
            await host.transform(second);
            expect(second.messages.slice(0, stored.messages.length)).toEqual(stored.messages);
            expect(JSON.stringify(first.messages.at(-1))).toContain("Steps executed: 1");
            expect(JSON.stringify(second.messages.at(-1))).toContain("Steps executed: 2");
            expect(first.messages.at(-1)).toMatchObject({ role: "user", content: [{ type: "text" }] });
        } finally { await host.dispose(); }
    });

    it("does not inject for ordinary or foreign sessions and removes context after cancellation", async () => {
        const host = await createHost();
        try {
            const ordinary = host.request();
            const original = structuredClone(ordinary);
            await host.transform(ordinary);
            expect(ordinary).toEqual(original);
            await host.prompt("/task Build caching fix");
            const foreign = host.request("ses_other");
            const foreignOriginal = structuredClone(foreign);
            await host.transform(foreign);
            expect(foreign).toEqual(foreignOriginal);
            const request = host.request();
            const originalRequest = structuredClone(request);
            await host.transform(request);
            expect(request.messages.length).toBe(originalRequest.messages.length + 1);
            await host.prompt("/stop");
            await host.transform(request);
            expect(request).toEqual(originalRequest);
        } finally { await host.dispose(); }
    });

    it("leaves an empty outgoing message list alone", async () => {
        const host = await createHost();
        try {
            await host.prompt("/task Build caching fix");
            const request = host.request();
            request.messages = [];
            const original = structuredClone(request);
            await host.transform(request);
            expect(request).toEqual(original);
        } finally { await host.dispose(); }
    });
});

function request(sessionID = SESSION) {
    const messages: unknown[] = [
        { role: "user", content: [{ type: "text", text: "Real user input" }] },
        { role: "assistant", content: [{ type: "tool-call", id: "call_1", name: "read", input: {} }] },
        { role: "tool", content: [{ type: "tool-result", id: "call_1", name: "read", result: { type: "text", value: "file" } }] },
    ];
    return { sessionID, agent: "Commander", model: { providerID: "p", id: "m" },
        system: [{ type: "text", text: "Stable host instructions", cache: "preserve", metadata: { fixture: true } }],
        options: {}, messages };
}

async function createHost() {
    const directory = mkdtempSync(path.join(tmpdir(), "oco-prefix-"));
    const hooks = new Map<string, Hook>();
    const registration = async () => ({ dispose: async () => {} });
    const hook = async (name: string, callback: Hook) => { hooks.set(name, callback); return registration(); };
    const cleanup = await OrchestratorPlugin.setup({
        location: { directory, project: { directory } }, options: { customRendering: false },
        agent: { list: async () => [], transform: registration }, session: { hook },
        tool: { hook, transform: registration }, command: { transform: registration },
        event: { subscribe: async function* () {} },
    } as unknown as Plugin.Context);
    return {
        directory,
        request: (sessionID = SESSION) => request(sessionID),
        prompt: async (text: string) => hooks.get("prompt")!({ sessionID: SESSION, prompt: { text } }),
        step: async () => hooks.get("execute.after")!({ sessionID: SESSION, tool: "fixture", id: "c1", input: {}, status: "completed", result: { content: "ok" } }),
        transform: async (value: ReturnType<typeof request>) => hooks.get("context")!(value),
        dispose: async () => {
            await cleanup();
            rmSync(directory, { recursive: true, force: true });
        },
    };
}
