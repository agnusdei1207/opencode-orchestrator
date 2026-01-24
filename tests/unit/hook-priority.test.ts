/**
 * Hook System Priority & Dependency Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import type { ChatMessageHook, HookContext } from "../../src/hooks/types";

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
});
