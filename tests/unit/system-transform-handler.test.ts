/**
 * System Transform Handler Tests
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSystemTransformHandler } from "../../src/plugin-handlers/system-transform-handler";
import type { EventHandlerContext, SystemTransformInput, SystemTransformOutput } from "../../src/plugin-handlers/interfaces";
import { isMissionActive, ensureSessionInitialized } from "../../src/core/orchestrator/session-manager";
import { readLoopState } from "../../src/core/loop/mission-loop";
import { ParallelAgentManager } from "../../src/core/agents/manager";

// Mock dependencies
vi.mock("../../src/core/loop/mission-loop", () => ({
    readLoopState: vi.fn(),
}));

vi.mock("../../src/core/orchestrator/session-manager", () => ({
    isMissionActive: vi.fn(),
    ensureSessionInitialized: vi.fn(),
}));

vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({
            getTasksByParent: vi.fn(() => []),
        })),
    },
}));

vi.mock("../../src/agents/commander", () => ({
    commander: {
        systemPrompt: "[COMMANDER_SYSTEM_PROMPT_MOCK]",
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

        // Default mocks
        vi.mocked(isMissionActive).mockReturnValue(true);
        vi.mocked(ensureSessionInitialized).mockReturnValue({ step: 5, active: true });
    });

    it("should inject system prompts for orchestrated sessions", async () => {
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
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            iteration: 1,
            maxIterations: 10,
            prompt: "Task",
            sessionID: "test-session",
            startedAt: new Date().toISOString(),
        });

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
        vi.mocked(isMissionActive).mockReturnValue(false);
        vi.mocked(readLoopState).mockReturnValue(null);

        const input: SystemTransformInput = { sessionID: "test-session" };
        const output: SystemTransformOutput = { system: [] };

        await handler(input, output);

        expect(output.system.length).toBe(0);
    });

    it("should include mission loop prompt", async () => {
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

    it("should inject knowledge RAG context from markdown sources", async () => {
        const testDir = mkdtempSync(path.join(tmpdir(), "oco-system-transform-"));
        mkdirSync(path.join(testDir, "docs"), { recursive: true });
        writeFileSync(
            path.join(testDir, "docs", "knowledge-memory.md"),
            "---\ntags: [planner, memory]\n---\nPlanner context injection uses a knowledge graph memory layer.",
            "utf8",
        );

        try {
            mockContext.directory = testDir;
            handler = createSystemTransformHandler(mockContext);

            vi.mocked(readLoopState).mockReturnValue({
                active: true,
                iteration: 1,
                maxIterations: 10,
                prompt: "planner memory context",
                sessionID: "test-session",
                startedAt: new Date().toISOString(),
            });

            const input: SystemTransformInput = { sessionID: "test-session" };
            const output: SystemTransformOutput = { system: [] };

            await handler(input, output);

            expect(output.system.some(s => s.includes("<knowledge_rag_context>"))).toBe(true);
            expect(output.system.some(s => s.includes("knowledge-memory"))).toBe(true);
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });
});
