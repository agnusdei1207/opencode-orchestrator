/**
 * Session Compacting Handler Tests
 * 
 * Tests the compaction hook handler:
 * - Mission loop context preservation
 * - Session progress context
 * - Background tasks context
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    createSessionCompactingHandler,
    type SessionCompactingInput,
    type SessionCompactingOutput,
} from "../../src/plugin-handlers/session-compacting-handler";
import type { EventHandlerContext } from "../../src/plugin-handlers/event-handler";
import { log } from "../../src/core/agents/logger";

// Mock dependencies
vi.mock("../../src/core/loop/mission-loop", () => ({
    readLoopState: vi.fn(),
}));

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("Session Compacting Handler", () => {
    let mockContext: EventHandlerContext;
    let handler: ReturnType<typeof createSessionCompactingHandler>;
    const agents = { getTasksByParent: vi.fn((): unknown[] => []) };

    beforeEach(() => {
        mockContext = {
            client: {} as any,
            directory: "/tmp/test",
            sessions: new Map([
                ["test-session", { step: 5, active: true, startTime: Date.now() - 300000 }],
            ]) as any,
            agents: agents as never,
            contextLimits: {} as never,
        };
        agents.getTasksByParent.mockReset().mockReturnValue([]);

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

    it("should inject background tasks context when tasks are running", async () => {
        agents.getTasksByParent.mockReturnValue([
            { id: "t1", sessionID: "s1", description: "Build UI", agent: "worker", status: "running" },
            { id: "t2", sessionID: "s2", description: "Write tests", agent: "worker", status: "running" },
        ]);

        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("Active background tasks"))).toBe(true);
        const context = output.context.find(c => c.includes("background_tasks_context"));
        expect(context).toContain("t1 session=s1 agent=worker status=running desc=Build UI");
        expect(context).toContain("t2 session=s2 agent=worker status=running desc=Write tests");
        expect(context).toContain("Wait for completion before finalizing.");
    });

    it("preserves pending delegated work across compaction", async () => {
        agents.getTasksByParent.mockReturnValue([{ id: "queued-1", sessionID: "child-1", description: "Queued check", agent: "reviewer", status: "pending" }]);
        const output: SessionCompactingOutput = { context: [] };
        await handler({ sessionID: "test-session" }, output);
        expect(output.context.join("\n")).toContain("queued-1 session=child-1 agent=reviewer status=pending");
    });

    it("should not modify output when no relevant context exists", async () => {
        // Clear all context sources
        mockContext.sessions.clear();

        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue(null);

        agents.getTasksByParent.mockReturnValue([]);

        const handler = createSessionCompactingHandler(mockContext);

        const input: SessionCompactingInput = { sessionID: "unknown-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.length).toBe(0);
    });

    it("should log background task lookup failures without aborting compaction", async () => {
        agents.getTasksByParent.mockImplementationOnce(() => {
            throw new Error("manager unavailable");
        });

        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("SESSION PROGRESS"))).toBe(true);
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to inspect background tasks for test-session"));
    });
});
