import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HookRegistry, type HookContext, type HookResult } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";

const context: HookContext = { sessionID: "pipeline", directory: "/tmp", sessions: new Map() };
let registry: HookRegistry;

beforeEach(() => {
    (HookRegistry as unknown as { instance?: HookRegistry }).instance = undefined;
    registry = HookRegistry.getInstance();
});
afterEach(() => vi.restoreAllMocks());

describe("Ordered hook execution", () => {
    it("passes modified arguments to later pre-tool hooks and preserves them in the result", async () => {
        registry.registerPreTool({ name: "rewrite", execute: async () => ({ action: HOOK_ACTIONS.MODIFY, modifiedArgs: { path: "safe" } }) });
        registry.registerPreTool({ name: "check", execute: async (_ctx, _tool, args) => {
            expect(args).toEqual({ path: "safe" });
            return { action: HOOK_ACTIONS.ALLOW };
        } });
        expect(await registry.executePreTool(context, "read", { path: "original" }))
            .toEqual({ action: HOOK_ACTIONS.ALLOW, modifiedArgs: { path: "safe" } });
    });

    it("returns a block reason without executing subsequent hooks", async () => {
        let laterRan = false;
        registry.registerPreTool({ name: "guard", execute: async () => ({ action: HOOK_ACTIONS.BLOCK, reason: "unsafe" }) });
        registry.registerPreTool({ name: "later", execute: async () => {
            laterRan = true;
            return { action: HOOK_ACTIONS.ALLOW };
        } });
        expect(await registry.executePreTool(context, "shell", {})).toEqual({ action: HOOK_ACTIONS.BLOCK, reason: "unsafe" });
        expect(laterRan).toBe(false);
    });

    it("passes redacted output to later hooks and preserves empty output and in-place mutations", async () => {
        const output = { title: "read", output: "secret", metadata: {} };
        registry.registerPostTool({ name: "redact", execute: async () => ({ output: "" }) });
        registry.registerPostTool({ name: "observe", execute: async (_ctx, _tool, _input, current) => {
            expect(current.output).toBe("");
            current.title = "redacted";
            current.metadata.safe = true;
            return {};
        } });
        await registry.executePostTool(context, "read", {}, output);
        expect(output).toEqual({ title: "redacted", output: "", metadata: { safe: true } });
    });

    it("applies chat rewrites in registration order while ignoring empty rewrites", async () => {
        registry.registerChat({ name: "first", execute: async (_ctx, message) => ({ action: HOOK_ACTIONS.PROCESS, modifiedMessage: message + " first" }) });
        registry.registerChat({ name: "empty", execute: async () => ({ action: HOOK_ACTIONS.PROCESS, modifiedMessage: "" }) });
        registry.registerChat({ name: "last", execute: async (_ctx, message) => ({ action: HOOK_ACTIONS.PROCESS, modifiedMessage: message + " last" }) });
        expect(await registry.executeChat(context, "request")).toEqual({ action: HOOK_ACTIONS.PROCESS, modifiedMessage: "request first last" });
    });

    it("intercepts chat without forwarding the message or executing later hooks", async () => {
        let laterRan = false;
        registry.registerChat({ name: "command", execute: async () => ({ action: HOOK_ACTIONS.INTERCEPT, modifiedMessage: "hidden" }) });
        registry.registerChat({ name: "later", execute: async () => {
            laterRan = true;
            return { action: HOOK_ACTIONS.PROCESS };
        } });
        expect(await registry.executeChat(context, "/cancel")).toEqual({ action: HOOK_ACTIONS.INTERCEPT });
        expect(laterRan).toBe(false);
    });

    it.each<HookResult>([
        { action: HOOK_ACTIONS.STOP, reason: "complete" },
        { action: HOOK_ACTIONS.INJECT, prompts: ["first", "second"] },
    ])("returns the first done intervention unchanged: $action", async (intervention) => {
        let laterRan = false;
        registry.registerDone({ name: "observe", execute: async () => ({ action: HOOK_ACTIONS.CONTINUE }) });
        registry.registerDone({ name: "intervene", execute: async () => intervention });
        registry.registerDone({ name: "later", execute: async () => {
            laterRan = true;
            return { action: HOOK_ACTIONS.INJECT, prompts: ["must not merge"] };
        } });
        expect(await registry.executeDone(context, "done")).toEqual(intervention);
        expect(laterRan).toBe(false);
    });

    it.each(["continue", "stop"] as const)("uses %s error handling across every hook entry point", async (errorHandling) => {
        const failure = async (): Promise<never> => { throw new Error("hook failed"); };
        const hook = { name: "failure", execute: failure };
        registry.registerPreTool(hook, errorHandling);
        registry.registerPostTool(hook, errorHandling);
        registry.registerChat(hook, errorHandling);
        registry.registerDone(hook, errorHandling);
        const reached: string[] = [];
        registry.registerPreTool({ name: "after", execute: async () => { reached.push("pre"); return { action: HOOK_ACTIONS.ALLOW }; } });
        registry.registerPostTool({ name: "after", execute: async () => { reached.push("post"); return {}; } });
        registry.registerChat({ name: "after", execute: async () => { reached.push("chat"); return { action: HOOK_ACTIONS.PROCESS }; } });
        registry.registerDone({ name: "after", execute: async () => { reached.push("done"); return { action: HOOK_ACTIONS.CONTINUE }; } });
        const calls = [
            () => registry.executePreTool(context, "read", {}),
            () => registry.executePostTool(context, "read", {}, { title: "read", output: "safe", metadata: {} }),
            () => registry.executeChat(context, "hello"),
            () => registry.executeDone(context, "done"),
        ];
        for (const call of calls) {
            if (errorHandling === "stop") await expect(call()).rejects.toThrow("hook failed");
            else await expect(call()).resolves.not.toThrow();
        }
        expect(reached).toEqual(errorHandling === "stop" ? [] : ["pre", "post", "chat", "done"]);
    });
});

describe("Owned hook wiring", () => {
    it.each(["guard", "secret", "mission"])("propagates failures from the owned %s safety boundary", async (failure) => {
        vi.resetModules();
        const { calls, hooks, initialize } = await traceOwnedHooks(failure);
        initialize();
        const execution = failure === "guard" ? hooks.executePreTool(context, "read", {})
            : failure === "secret" ? hooks.executePostTool(context, "read", {}, { title: "read", output: "secret", metadata: {} })
            : hooks.executeChat(context, "hello");
        await expect(execution).rejects.toThrow(`${failure} failed`);
        expect(calls).toEqual(failure === "mission" ? ["mission"] : [failure]);
    });

    it("continues completion checks after a failed sanity observer", async () => {
        vi.resetModules();
        const { calls, hooks, initialize } = await traceOwnedHooks("sanity");
        initialize();
        expect(await hooks.executeDone(context, "done")).toEqual({ action: HOOK_ACTIONS.CONTINUE });
        expect(calls).toEqual(["sanity", "resource", "memory", "metrics"]);
    });

    it("runs each owned lifecycle in its established order exactly once", async () => {
        vi.resetModules();
        const { calls, hooks, initialize } = await traceOwnedHooks();
        initialize();
        initialize();
        await hooks.executePreTool(context, "read", {});
        expect(calls.splice(0)).toEqual(["guard", "metrics"]);
        await hooks.executePostTool(context, "read", {}, { title: "read", output: "safe", metadata: {} });
        expect(calls.splice(0)).toEqual(["secret", "resource", "memory", "metrics"]);
        await hooks.executeChat(context, "hello");
        expect(calls.splice(0)).toEqual(["mission"]);
        expect(await hooks.executeDone(context, "done")).toEqual({ action: HOOK_ACTIONS.CONTINUE });
        expect(calls).toEqual(["sanity", "resource", "memory", "metrics"]);
    });
});

async function traceOwnedHooks(failure?: string) {
    const { StrictRoleGuardHook } = await import("../../src/hooks/custom/strict-role-guard");
    const { SecretScannerHook } = await import("../../src/hooks/custom/secret-scanner");
    const { ResourceControlHook } = await import("../../src/hooks/custom/resource-control");
    const { MemoryGateHook } = await import("../../src/hooks/custom/memory-gate");
    const { MetricsHook } = await import("../../src/hooks/custom/metrics");
    const { MissionControlHook } = await import("../../src/hooks/features/mission-loop");
    const { SanityCheckHook } = await import("../../src/hooks/features/sanity-check");
    const calls: string[] = [];
    const record = (name: string) => {
        calls.push(name);
        if (name === failure) throw new Error(`${name} failed`);
    };
    vi.spyOn(StrictRoleGuardHook.prototype, "execute").mockImplementation(async () => { record("guard"); return { action: HOOK_ACTIONS.ALLOW }; });
    vi.spyOn(SecretScannerHook.prototype, "execute").mockImplementation(async () => { record("secret"); return {}; });
    for (const [name, prototype] of [
        ["resource", ResourceControlHook.prototype], ["memory", MemoryGateHook.prototype],
        ["metrics", MetricsHook.prototype], ["mission", MissionControlHook.prototype],
        ["sanity", SanityCheckHook.prototype],
    ] as const) {
        vi.spyOn(prototype, "execute").mockImplementation(async () => {
            record(name);
            return { action: HOOK_ACTIONS.CONTINUE };
        });
    }
    const { initializeHooks } = await import("../../src/hooks/index");
    const { HookRegistry: OwnedHooks } = await import("../../src/hooks/registry");
    return { calls, hooks: OwnedHooks.getInstance(), initialize: initializeHooks };
}
