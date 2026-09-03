import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserActivityHook } from "../../src/hooks/custom/user-activity.js";
import { MetricsHook } from "../../src/hooks/custom/metrics.js";
import { MetricsCollector } from "../../src/core/metrics/collector.js";
import * as TodoContinuation from "../../src/core/loop/todo-continuation.js";
import { HOOK_ACTIONS } from "../../src/hooks/constants.js";

describe("Custom Hooks Suite", () => {
    describe("UserActivityHook", () => {
        it("triggers TodoContinuation.handleUserMessage when sessionID is present", async () => {
            const spy = vi.spyOn(TodoContinuation, "handleUserMessage").mockImplementation(() => {});
            const hook = new UserActivityHook();

            const result = await hook.execute(
                { sessionID: "s123", directory: "/tmp", sessions: new Map() },
                "user said hello"
            );

            expect(spy).toHaveBeenCalledWith("s123");
            expect(result.action).toBe(HOOK_ACTIONS.PROCESS);

            spy.mockRestore();
        });

        it("handles missing sessionID gracefully", async () => {
            const spy = vi.spyOn(TodoContinuation, "handleUserMessage").mockImplementation(() => {});
            const hook = new UserActivityHook();

            const result = await hook.execute(
                { sessionID: undefined as any, directory: "/tmp", sessions: new Map() },
                "user said hello"
            );

            expect(spy).not.toHaveBeenCalled();
            expect(result.action).toBe(HOOK_ACTIONS.PROCESS);

            spy.mockRestore();
        });
    });

    describe("MetricsHook", () => {
        beforeEach(() => {
            MetricsCollector._resetForTesting();
        });

        it("handles pre-tool and post-tool lifecycle", async () => {
            const hook = new MetricsHook();
            const ctx = { sessionID: "s1", directory: "/tmp", sessions: new Map() };

            // Pre-tool
            const preResult = await hook.execute(ctx, "grep_search", { query: "foo" });
            expect(preResult.action).toBe(HOOK_ACTIONS.ALLOW);

            // Post-tool
            const postResult = await hook.execute(ctx, "grep_search", { query: "foo" }, { output: "result text of tool" });
            expect(postResult).toEqual({});

            const stats = MetricsCollector.getInstance().getStats();
            expect(stats.avgToolLatency["grep_search"]).toBeDefined();
            expect(stats.tokenUsage).toBeGreaterThan(0);
        });

        it("handles assistant done hook call", async () => {
            const hook = new MetricsHook();
            const ctx = { sessionID: "s1", directory: "/tmp", sessions: new Map() };

            const result = await hook.execute(ctx, "Finished mission output text");
            expect(result.action).toBe(HOOK_ACTIONS.CONTINUE);

            const stats = MetricsCollector.getInstance().getStats();
            expect(stats.tokenUsage).toBeGreaterThan(0);
        });
    });
});
