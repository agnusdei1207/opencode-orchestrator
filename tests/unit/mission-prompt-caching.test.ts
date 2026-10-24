import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { describe, expect, it } from "vitest";
import OrchestratorPlugin from "../../src/index.js";
import { readLoopState, writeLoopState } from "../../src/core/loop/mission-loop.js";

const SESSION = "ses_cache_owner";
type Hook = (input: unknown) => Promise<void>;
type V1Hooks = Awaited<ReturnType<typeof OrchestratorPlugin.server>>;
type V1Messages = Parameters<NonNullable<V1Hooks["experimental.chat.messages.transform"]>>[1]["messages"];

describe.each(["v1", "v2"] as const)("mission prompt cache compatibility: %s (issue #57)", version => {
    it("keeps system and conversation prefix identical as all runtime fields change", async () => {
        const host = await createHost(version);
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
            writeLoopState(host.directory, { ...state, iteration: 9, lastProgress: "4/5", lastVerificationSummary: "all tests pass" });
            writeFileSync(path.join(host.directory, ".opencode/docs/brain/scratchpad.md"), "Current scratchpad");
            await host.transform(request);
            expect(request.messages.length).toBe(count + 1);
            expect(JSON.stringify(request.system)).toBe(system);
            expect(JSON.stringify(request.messages.slice(0, count))).toBe(history);
            const tail = JSON.stringify(request.messages.at(-1));
            for (const value of ["Steps executed: 2", "Iteration 9/", "4/5", "all tests pass", "Current scratchpad"]) {
                expect(tail).toContain(value);
            }
        } finally { await host.dispose(); }
    });

    it("adds fresh context to growing outgoing copies without rewriting stored history", async () => {
        const host = await createHost(version);
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
            if (version === "v1") {
                const tail = first.messages.at(-1) as V1Messages[number];
                expect(tail.info).toMatchObject({ role: "user", sessionID: SESSION, agent: "Commander" });
                expect(tail.parts[0]).toMatchObject({ type: "text", synthetic: true, sessionID: SESSION, messageID: tail.info.id });
            } else {
                expect(first.messages.at(-1)).toMatchObject({ role: "user", content: [{ type: "text" }] });
            }
        } finally { await host.dispose(); }
    });

    it("does not inject for ordinary or foreign sessions and removes context after cancellation", async () => {
        const host = await createHost(version);
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
        const host = await createHost(version);
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

function request(version: "v1" | "v2", sessionID = SESSION) {
    const messages: unknown[] = version === "v1" ? [{
        info: { id: "msg_user", sessionID, role: "user", agent: "Commander", model: { providerID: "p", modelID: "m" }, time: { created: 1 } },
        parts: [{ type: "text", id: "prt_user", messageID: "msg_user", sessionID, text: "Real user input" }],
    }, {
        info: { id: "msg_tool", sessionID, role: "assistant" },
        parts: [{ type: "tool", callID: "call_1", tool: "read", state: { status: "completed", input: {}, output: "file" } }],
    }] : [
        { role: "user", content: [{ type: "text", text: "Real user input" }] },
        { role: "assistant", content: [{ type: "tool-call", id: "call_1", name: "read", input: {} }] },
        { role: "tool", content: [{ type: "tool-result", id: "call_1", name: "read", result: { type: "text", value: "file" } }] },
    ];
    return { sessionID, agent: "Commander", model: { providerID: "p", id: "m" },
        system: [{ type: "text", text: "Stable host instructions", cache: "preserve", metadata: { fixture: true } }],
        options: {}, messages };
}

async function createHost(version: "v1" | "v2") {
    const directory = mkdtempSync(path.join(tmpdir(), `oco-prefix-${version}-`));
    const hooks = new Map<string, Hook>();
    const registration = async () => ({ dispose: async () => {} });
    let instance: V1Hooks | undefined;
    let cleanup: (() => Promise<void>) | undefined;
    if (version === "v1") {
        instance = await OrchestratorPlugin.server({ directory, client: {} } as Parameters<typeof OrchestratorPlugin.server>[0], { customRendering: false });
    } else {
        const hook = async (name: string, callback: Hook) => { hooks.set(name, callback); return registration(); };
        cleanup = await OrchestratorPlugin.setup({
            location: { directory, project: { directory } }, options: { customRendering: false },
            agent: { list: async () => [], transform: registration }, session: { hook },
            tool: { hook, transform: registration }, command: { transform: registration },
            event: { subscribe: async function* () {} },
        } as unknown as Plugin.Context);
    }
    return hostActions({ directory, hooks, instance, cleanup, version });
}

function hostActions(host: { directory: string; hooks: Map<string, Hook>; instance?: V1Hooks; cleanup?: () => Promise<void>; version: "v1" | "v2" }) {
    return {
        directory: host.directory,
        request: (sessionID = SESSION) => request(host.version, sessionID),
        prompt: async (text: string) => {
            if (host.instance) {
                const chat = host.instance["chat.message"]!;
                await chat({ sessionID: SESSION, agent: "Commander" }, { message: {}, parts: [{ type: "text", text }] } as Parameters<typeof chat>[1]);
            } else await host.hooks.get("prompt")!({ sessionID: SESSION, prompt: { text } });
        },
        step: async () => {
            if (host.instance) await host.instance["tool.execute.after"]!({ sessionID: SESSION, tool: "fixture", callID: "c1", args: {} }, { title: "fixture", output: "ok", metadata: {} });
            else await host.hooks.get("execute.after")!({ sessionID: SESSION, tool: "fixture", id: "c1", input: {}, status: "completed", result: { content: "ok" } });
        },
        transform: async (value: ReturnType<typeof request>) => {
            if (host.instance) {
                expect(host.instance["experimental.chat.system.transform"]).toBeUndefined();
                await host.instance["experimental.chat.messages.transform"]!({}, { messages: value.messages as V1Messages });
            } else await host.hooks.get("context")!(value);
        },
        dispose: async () => {
            await host.instance?.dispose?.();
            await host.cleanup?.();
            rmSync(host.directory, { recursive: true, force: true });
        },
    };
}
