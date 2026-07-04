/**
 * Hook System Priority & Dependency Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    HookRegistry,
    type ChatMessageHook,
    type HookContext,
    type PostToolUseHook,
} from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import { initializeHooks } from "../../src/hooks/index";

describe("Hook Registry (Priority & Dependencies)", () => {
    let registry: HookRegistry;
    let mockContext: HookContext;

    beforeEach(() => {
        // Reset singleton-ish behavior for testing
        // @ts-ignore
        HookRegistry.instance = new HookRegistry();
        registry = HookRegistry.getInstance();
        mockContext = {
            sessionID: "test",
            directory: "/tmp",
            sessions: new Map()
        };
    });

    it("should execute hooks in priority order", async () => {
        const executionOrder: string[] = [];

        const hook1: ChatMessageHook = {
            name: "hook1",
            execute: async () => { executionOrder.push("hook1"); return { action: HOOK_ACTIONS.PROCESS }; }
        };
        const hook2: ChatMessageHook = {
            name: "hook2",
            execute: async () => { executionOrder.push("hook2"); return { action: HOOK_ACTIONS.PROCESS }; }
        };

        registry.registerChat(hook2, { priority: 20 });
        registry.registerChat(hook1, { priority: 10 });

        await registry.executeChat(mockContext, "test");
        expect(executionOrder).toEqual(["hook1", "hook2"]);
    });

    it("should respect phases (early > normal > late)", async () => {
        const executionOrder: string[] = [];

        const register = (name: string, phase: any, priority: number) => {
            registry.registerChat({
                name,
                execute: async () => { executionOrder.push(name); return { action: HOOK_ACTIONS.PROCESS }; }
            }, { phase, priority });
        };

        register("late-1", "late", 1);
        register("early-2", "early", 100); // Priority is high but phase is early
        register("normal-1", "normal", 50);

        await registry.executeChat(mockContext, "test");
        expect(executionOrder).toEqual(["early-2", "normal-1", "late-1"]);
    });

    it("should handle dependencies via topological sort", async () => {
        const executionOrder: string[] = [];

        const register = (name: string, deps: string[]) => {
            registry.registerChat({
                name,
                execute: async () => { executionOrder.push(name); return { action: HOOK_ACTIONS.PROCESS }; }
            }, { dependencies: deps, name });
        };

        register("B", ["A"]);
        register("A", []);
        register("C", ["B"]);

        await registry.executeChat(mockContext, "test");
        expect(executionOrder).toEqual(["A", "B", "C"]);
    });

    it("should throw error on circular dependencies", () => {
        const hookA: ChatMessageHook = { name: "A", execute: vi.fn() };
        const hookB: ChatMessageHook = { name: "B", execute: vi.fn() };

        registry.registerChat(hookA, { name: "A", dependencies: ["B"] });

        // This should trigger topological sort and detect cycle
        expect(() => {
            registry.registerChat(hookB, { name: "B", dependencies: ["A"] });
        }).toThrow();
    });

    it("should throw error on missing dependencies", async () => {
        const hook: ChatMessageHook = { name: "needs-missing", execute: vi.fn() };

        registry.registerChat(hook, {
            name: "needs-missing",
            dependencies: ["missing-hook"],
        });

        await expect(registry.executeChat(mockContext, "test"))
            .rejects.toThrow("Missing hook dependency: missing-hook");
    });

    it("should respect errorHandling: stop", async () => {
        const hook1: ChatMessageHook = {
            name: "fail",
            execute: async () => { throw new Error("Abort"); }
        };
        const hook2: ChatMessageHook = {
            name: "second",
            execute: async () => { return { action: HOOK_ACTIONS.PROCESS }; }
        };

        registry.registerChat(hook1, { name: "fail", errorHandling: "stop" });
        registry.registerChat(hook2, { name: "second", priority: 100 });

        await expect(registry.executeChat(mockContext, "test")).rejects.toThrow("Abort");
    });

    it("should not throw a cross-phase dependency error after initializeHooks", async () => {
        // Regression for #32: metrics-post declared a dependency on metrics-pre,
        // which lives in the pre-tool phase array. validateDependencies only sees
        // same-phase names, so every post-tool execution threw
        // "Missing hook dependency: metrics-pre".
        initializeHooks();

        const output = { title: "read", output: "file contents", metadata: {} };

        await expect(
            registry.executePostTool(mockContext, "read", { path: "/tmp/x" }, output)
        ).resolves.not.toThrow();
    });

    it("every default hook dependency resolves within its own phase (guards #32-class cross-phase wiring)", () => {
        // The real defect behind #32 was invisible to the suite because no test
        // exercised the actual initializeHooks() wiring — only the registry
        // primitives in isolation. validateDependencies resolves dependency
        // names ONLY within the same phase array, so any default hook that
        // depends on a name registered in a different phase silently breaks
        // every execution of that phase at runtime. Assert that invariant
        // directly across all four phase arrays.
        initializeHooks();

        const phases: [string, Array<{ metadata: { name: string; dependencies?: string[] } }>][] = [
            ["preTool", (registry as any).preToolHooks],
            ["postTool", (registry as any).postToolHooks],
            ["chat", (registry as any).chatHooks],
            ["done", (registry as any).doneHooks],
        ];

        for (const [phase, regs] of phases) {
            const namesInPhase = new Set(regs.map((r) => r.metadata.name));
            for (const reg of regs) {
                for (const dep of reg.metadata.dependencies || []) {
                    expect(
                        namesInPhase.has(dep),
                        `Hook "${reg.metadata.name}" in phase "${phase}" depends on "${dep}", ` +
                            `which is not registered in the same phase. validateDependencies ` +
                            `will throw "Missing hook dependency: ${dep}" on every ${phase} execution.`
                    ).toBe(true);
                }
            }
        }
    });

    it("should preserve empty string output from post-tool hooks", async () => {
        const hook: PostToolUseHook = {
            name: "redact-all",
            execute: async () => ({ output: "" }),
        };
        const output = { title: "tool", output: "secret output", metadata: {} };

        registry.registerPostTool(hook);

        await registry.executePostTool(mockContext, "tool", {}, output);

        expect(output.output).toBe("");
    });
});
