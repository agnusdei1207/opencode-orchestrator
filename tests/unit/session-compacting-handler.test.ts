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
import { createSessionCompactingHandler } from "../../src/plugin-handlers/session-compacting-handler";
import type { EventHandlerContext, SessionCompactingInput, SessionCompactingOutput } from "../../src/plugin-handlers/interfaces";

// Mock dependencies
vi.mock("../../src/core/loop/mission-seal", () => ({
    readLoopState: vi.fn(),
}));

vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({
            getTasksByParent: vi.fn(() => []),
        })),
    },
}));

describe("Session Compacting Handler", () => {
    let mockContext: EventHandlerContext;
    let handler: ReturnType<typeof createSessionCompactingHandler>;

    beforeEach(() => {
        mockContext = {
            client: {} as any,
            directory: "/tmp/test",
            sessions: new Map([
                ["test-session", { step: 5, active: true, startTime: Date.now() - 300000 }],
            ]) as any,
            state: {
                missionActive: false,
                sessions: new Map([
                    ["test-session", { enabled: true, iterations: 3, currentTask: "Building", taskRetries: new Map(), anomalyCount: 0 }],
                ]),
            },
        };

        handler = createSessionCompactingHandler(mockContext);
    });

    it("should create handler successfully", () => {
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
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
        const { readLoopState } = await import("../../src/core/loop/mission-seal");
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
    });

    it("should not inject mission context for different session", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-seal");
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
        const { ParallelAgentManager } = await import("../../src/core/agents/manager");
        vi.mocked(ParallelAgentManager.getInstance).mockReturnValue({
            getTasksByParent: vi.fn(() => [
                { id: "t1", description: "Build UI", agent: "worker", status: "running" },
                { id: "t2", description: "Write tests", agent: "worker", status: "running" },
            ]),
        } as any);

        const input: SessionCompactingInput = { sessionID: "test-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.some(c => c.includes("RUNNING BACKGROUND TASKS"))).toBe(true);
        expect(output.context.some(c => c.includes("Build UI"))).toBe(true);
    });

    it("should not modify output when no relevant context exists", async () => {
        // Clear all context sources
        mockContext.sessions.clear();
        mockContext.state.sessions.clear();

        const { readLoopState } = await import("../../src/core/loop/mission-seal");
        vi.mocked(readLoopState).mockReturnValue(null);

        // Reset ParallelAgentManager to return empty tasks
        const { ParallelAgentManager } = await import("../../src/core/agents/manager");
        vi.mocked(ParallelAgentManager.getInstance).mockReturnValue({
            getTasksByParent: vi.fn(() => []),
        } as any);

        const handler = createSessionCompactingHandler(mockContext);

        const input: SessionCompactingInput = { sessionID: "unknown-session" };
        const output: SessionCompactingOutput = { context: [] };

        await handler(input, output);

        expect(output.context.length).toBe(0);
    });
});
