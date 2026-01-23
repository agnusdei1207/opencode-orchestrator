/**
 * System Transform Handler Tests
 * 
 * Tests the experimental.chat.system.transform hook handler:
 * - Dynamic system prompt injection
 * - Mission loop prompts
 * - Background task awareness
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSystemTransformHandler } from "../../src/plugin-handlers/system-transform-handler";
import type { EventHandlerContext, SystemTransformInput, SystemTransformOutput } from "../../src/plugin-handlers/interfaces";

// Mock dependencies
vi.mock("../../src/core/loop/mission-loop", () => ({
    readLoopState: vi.fn(),
}));

vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({
            getTasksByParent: vi.fn(() => []),
        })),
    },
}));

describe("System Transform Handler", () => {
    let mockContext: EventHandlerContext;
    let handler: ReturnType<typeof createSystemTransformHandler>;

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

        handler = createSystemTransformHandler(mockContext);
    });

    it("should create handler successfully", () => {
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
    });

    it("should inject system prompts for orchestrated sessions", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 2,
            maxIterations: 10,
            prompt: "Build the feature",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

        const input: SystemTransformInput = { sessionID: "test-session" };
        const output: SystemTransformOutput = { system: [] };

        await handler(input, output);

        expect(output.system.length).toBeGreaterThan(0);
        expect(output.system.some(s => s.includes("MISSION LOOP ACTIVE"))).toBe(true);
    });

    it("should inject active session prompt", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 1,
            maxIterations: 10,
            prompt: "Task",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

        const input: SystemTransformInput = { sessionID: "test-session" };
        const output: SystemTransformOutput = { system: [] };

        await handler(input, output);

        expect(output.system.some(s => s.includes("Orchestrator Session Active"))).toBe(true);
        expect(output.system.some(s => s.includes("Steps executed: 5"))).toBe(true);
    });

    it("should inject background tasks prompt when tasks exist", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 1,
            maxIterations: 10,
            prompt: "Task",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

        const { ParallelAgentManager } = await import("../../src/core/agents/manager");
        vi.mocked(ParallelAgentManager.getInstance).mockReturnValue({
            getTasksByParent: vi.fn(() => [
                { id: "t1", status: "running" },
                { id: "t2", status: "pending" },
                { id: "t3", status: "completed" },
            ]),
        } as any);

        const input: SystemTransformInput = { sessionID: "test-session" };
        const output: SystemTransformOutput = { system: [] };

        await handler(input, output);

        expect(output.system.some(s => s.includes("Background Tasks Status"))).toBe(true);
        expect(output.system.some(s => s.includes("Running: 1"))).toBe(true);
        expect(output.system.some(s => s.includes("Pending: 1"))).toBe(true);
    });

    it("should not inject for non-orchestrated sessions", async () => {
        mockContext.state.sessions.clear();

        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue(null);

        const handler = createSystemTransformHandler(mockContext);

        const input: SystemTransformInput = { sessionID: "test-session" };
        const output: SystemTransformOutput = { system: [] };

        await handler(input, output);

        expect(output.system.length).toBe(0);
    });

    it("should include mission loop prompt", async () => {
        const { readLoopState } = await import("../../src/core/loop/mission-loop");
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 5,
            maxIterations: 10,
            prompt: "Complete the feature",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

        const input: SystemTransformInput = { sessionID: "test-session" };
        const output: SystemTransformOutput = { system: [] };

        await handler(input, output);

        expect(output.system.some(s => s.includes("MISSION LOOP ACTIVE"))).toBe(true);
        expect(output.system.some(s => s.includes("Iteration 5/10"))).toBe(true);
    });
});
