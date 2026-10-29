/**
 * Session Compacting Handler Tests
 * 
 * Tests the experimental.session.compacting hook handler:
 * - Mission loop context preservation
 * - Session progress context
 * - Orchestrator state context
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
import { clearCompactionState, getCompactionState } from "../../src/core/loop/compaction-guard";

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
            state: {
                sessions: new Map([
                    ["test-session", { enabled: true, iterations: 3, currentTask: "Building", taskRetries: new Map(), anomalyCount: 0 }],
                ]),
            },
            agents: agents as never,
        };
        agents.getTasksByParent.mockReset().mockReturnValue([]);

        handler = createSessionCompactingHandler(mockContext);
    });

    it("should create handler successfully", () => {
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
    });

    it("does not record completed compaction while preparing its context", async () => {
        clearCompactionState("test-session");
        const output: SessionCompactingOutput = { context: ["host context"], prompt: "host prompt" };
        await handler({ sessionID: "test-session" }, output);
        expect(getCompactionState("test-session")).toBeUndefined();
        expect(output.context[0]).toBe("host context");
        expect(output.prompt).toBe("host prompt");
    });

    it("should inject session context when session exists", async () => {
        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.length).toBeGreaterThan(0);
        expect(output.context.some(c => c.includes("SESSION PROGRESS"))).toBe(true);
    });

    it("should inject orchestrator context when session is enabled", async () => {
        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("ORCHESTRATOR STATE"))).toBe(true);
        expect(output.context.some(c => c.includes("Iterations: 3"))).toBe(true);
    });

    it("should inject mission context when loop is active", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 2,
            maxIterations: 10,
            prompt: "Build the feature",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("ACTIVE MISSION LOOP"))).toBe(true);
        expect(output.context.some(c => c.includes("Iteration 2/10"))).toBe(true);
        expect(output.context.join("\n")).toContain("parent status: completed");
    });

    it("should not inject mission context for different session", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 1,
            maxIterations: 10,
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
        mockContext.state.sessions.clear();

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
