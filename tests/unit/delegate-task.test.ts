import { describe, expect, it, vi } from "vitest";
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
});
