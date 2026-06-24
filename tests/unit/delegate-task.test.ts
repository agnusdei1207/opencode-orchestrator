import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDelegateTaskTool } from "../../src/tools/parallel/delegate-task";
import type { ParallelAgentManager } from "../../src/core/agents/manager";

vi.mock("@opencode-ai/plugin", () => {
    const schemaValue = {
        optional: () => schemaValue,
        describe: () => schemaValue,
    };
    const mockSchema = {
        string: () => schemaValue,
        boolean: () => schemaValue,
        number: () => schemaValue,
        array: () => schemaValue,
        enum: () => schemaValue,
        object: () => schemaValue,
    };
    const mockTool = vi.fn((config: unknown) => config) as unknown as {
        schema: typeof mockSchema;
    };
    mockTool.schema = mockSchema;
    return { tool: mockTool };
});

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("createDelegateTaskTool", () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it("routes resume requests through manager.resume without launching a new task", async () => {
        const resumedTask = {
            id: "task-existing",
            sessionID: "session-existing",
            parentSessionID: "parent-session",
            description: "Existing task",
            prompt: "Old prompt",
            agent: "Worker",
            status: "running",
            startedAt: new Date(),
        };
        const manager = {
            getAllTasks: vi.fn(() => []),
            launch: vi.fn(),
            resume: vi.fn().mockResolvedValue(resumedTask),
        } as unknown as ParallelAgentManager;
        const client = {
            session: {
                messages: vi.fn(),
                status: vi.fn(),
            },
        };

        const delegateTask = createDelegateTaskTool(manager, client);
        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Continue existing task",
                prompt: "Continue from prior state",
                background: true,
                resume: "session-existing",
            },
            { sessionID: "parent-session" },
        );

        expect(manager.resume).toHaveBeenCalledWith({
            sessionId: "session-existing",
            prompt: "Continue from prior state",
            parentSessionID: "parent-session",
        });
        expect(manager.launch).not.toHaveBeenCalled();
        expect(result).toContain("session-existing");
    });

    it("does not treat message fetch failures as valid sync output", async () => {
        vi.useFakeTimers();
        const launchedTask = {
            id: "task-sync",
            sessionID: "session-sync",
            parentSessionID: "parent-session",
            description: "Sync task",
            prompt: "Do sync work",
            agent: "Worker",
            status: "running",
            startedAt: new Date(),
        };
        const manager = {
            getAllTasks: vi.fn(() => []),
            launch: vi.fn().mockResolvedValue(launchedTask),
            resume: vi.fn(),
        } as unknown as ParallelAgentManager;
        const client = {
            session: {
                status: vi.fn().mockResolvedValue({ data: { "session-sync": { type: "idle" } } }),
                messages: vi.fn().mockRejectedValue(new Error("messages unavailable")),
            },
        };

        const delegateTask = createDelegateTaskTool(manager, client);
        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Run sync task",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        const result = await resultPromise;

        expect(result).toContain("TIMEOUT");
        expect(result).not.toContain("DONE");
        expect(client.session.messages).toHaveBeenCalled();
    });
});
