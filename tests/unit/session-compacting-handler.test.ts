/**
 * Session Compacting Handler Tests
 * 
 * Tests the compaction hook handler:
 * - Mission loop context preservation
 * - Session progress context
 * - Busy delegated child sessions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    createSessionCompactingHandler,
    type SessionCompactingInput,
    type SessionCompactingOutput,
} from "../../src/plugin-handlers/session-compacting-handler";
import type { EventHandlerContext } from "../../src/plugin-handlers/event-handler";
import { ChildSessions } from "../../src/core/session/child-sessions";

// Mock dependencies
vi.mock("../../src/core/loop/mission-loop", () => ({
    readLoopState: vi.fn(),
}));

vi.mock("../../src/shared/logger", () => ({ log: vi.fn() }));

describe("Session Compacting Handler", () => {
    let mockContext: EventHandlerContext;
    let handler: ReturnType<typeof createSessionCompactingHandler>;
    let children: ChildSessions;
    let statuses: Map<string, string>;

    beforeEach(() => {
        children = new ChildSessions();
        statuses = new Map();
        mockContext = {
            client: { statuses: () => statuses } as any,
            directory: "/tmp/test",
            sessions: new Map([
                ["test-session", { step: 5, active: true, startTime: Date.now() - 300000 }],
            ]) as any,
            children,
            contextLimits: {} as never,
        };

        handler = createSessionCompactingHandler(mockContext);
    });

    it("should create handler successfully", () => {
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
    });

    it("appends to the host's own compaction context", async () => {
        const output: SessionCompactingOutput = { context: ["host context"] };
        await handler({ sessionID: "test-session" }, output);
        expect(output.context[0]).toBe("host context");
        expect(output.context.length).toBeGreaterThan(1);
    });

    it("should inject session context when session exists", async () => {
        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.length).toBeGreaterThan(0);
        expect(output.context.some(c => c.includes("SESSION PROGRESS"))).toBe(true);
    });

    it("does not inject the removed orchestrator state block", async () => {
        const output: SessionCompactingOutput = { context: [] };

        await handler({ sessionID: "test-session" }, output);

        expect(output.context.join("\n")).not.toContain("orchestrator_context");
        expect(output.context.join("\n")).not.toContain("ORCHESTRATOR STATE");
    });

    it("should inject mission context when loop is active", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 2,
            prompt: "Build the feature",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("ACTIVE MISSION LOOP"))).toBe(true);
        const mission = output.context.find(c => c.includes("ACTIVE MISSION LOOP"));
        expect(mission).toContain("Status: Active (Iteration 2)");
        expect(mission).not.toContain("Last Progress");
        expect(output.context.join("\n")).toContain("parent status: completed");
    });

    it("should not inject mission context for different session", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 1,
            prompt: "Other task",
            sessionID: "other-session",
            startedAt: new Date().toISOString(),
        });

        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("ACTIVE MISSION LOOP"))).toBe(false);
    });

    it("lists busy delegated child sessions", async () => {
        children.add("test-session", "child-1");
        children.add("test-session", "child-2");
        children.add("test-session", "child-idle");
        children.add("other-parent", "foreign-child");
        statuses.set("child-1", "busy");
        statuses.set("child-2", "retry");
        statuses.set("foreign-child", "busy");

        const output: SessionCompactingOutput = { context: [] };
        await handler({ sessionID: "test-session" }, output);

        const context = output.context.find(c => c.includes("background_tasks_context"));
        expect(context).toContain("Delegated subagent sessions still running (2)");
        expect(context).toContain("- child-1");
        expect(context).toContain("- child-2");
        expect(context).not.toContain("child-idle");
        expect(context).not.toContain("foreign-child");
        expect(context).toContain("Wait for their completion notices before finalizing.");
    });

    it("omits the delegated sessions block when every child is idle", async () => {
        children.add("test-session", "child-1");
        const output: SessionCompactingOutput = { context: [] };
        await handler({ sessionID: "test-session" }, output);
        expect(output.context.join("\n")).not.toContain("background_tasks_context");
    });

    it("should not modify output when no relevant context exists", async () => {
        // Clear all context sources
        mockContext.sessions.clear();

        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue(null);

        const handler = createSessionCompactingHandler(mockContext);

        const input: SessionCompactingInput = { sessionID: "unknown-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.length).toBe(0);
    });
});
