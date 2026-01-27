import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnifiedTaskExecutor } from "../../src/core/agents/unified-task-executor.js";
import { AdaptiveConcurrencyController } from "../../src/core/agents/adaptive-concurrency.js";
import { SessionPool } from "../../src/core/agents/session-pool.js";
import { TASK_STATUS } from "../../src/shared/index.js";

describe("UnifiedTaskExecutor", () => {
    let executor: UnifiedTaskExecutor;
    let mockClient: any;
    let mockPool: any;
    let adaptive: AdaptiveConcurrencyController;

    beforeEach(() => {
        mockClient = {
            session: {
                prompt: vi.fn().mockResolvedValue({}),
            }
        };

        mockPool = {
            acquireImmediate: vi.fn().mockResolvedValue({ id: "sub_sess_1", agentName: "worker" }),
            release: vi.fn().mockResolvedValue({}),
            invalidate: vi.fn().mockResolvedValue({}),
        };

        adaptive = new AdaptiveConcurrencyController({ globalMax: 5, perAgentMax: 2 });
        executor = new UnifiedTaskExecutor(mockClient, mockPool, adaptive);
    });

    it("should launch a task and track it", async () => {
        const task = await executor.launch({
            agent: "worker",
            description: "Fix bug",
            prompt: "Go fix it",
            parentSessionID: "parent_sess",
            depth: 1
        });

        expect(task.id).toBeDefined();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(mockPool.acquireImmediate).toHaveBeenCalledWith("worker", "parent_sess", "Fix bug");
        expect(mockClient.session.prompt).toHaveBeenCalled();
    });

    it("should complete task and release resources on session.idle", async () => {
        const task = await executor.launch({
            agent: "worker",
            description: "Test",
            prompt: "Test",
            parentSessionID: "p1"
        });

        // Simulate idle event
        await executor.handleEvent({
            type: "session.idle",
            properties: { id: task.sessionID }
        });

        const updatedTask = executor.getTask(task.id);
        expect(updatedTask?.status).toBe(TASK_STATUS.COMPLETED);
        expect(mockPool.release).toHaveBeenCalledWith(task.sessionID);
    });

    it("should handle session.error and invalidate session", async () => {
        const task = await executor.launch({
            agent: "worker",
            description: "Fail test",
            prompt: "Fail",
            parentSessionID: "p1"
        });

        // Simulate error event
        await executor.handleEvent({
            type: "session.error",
            properties: { id: task.sessionID }
        });

        const updatedTask = executor.getTask(task.id);
        expect(updatedTask?.status).toBe(TASK_STATUS.ERROR);
        expect(mockPool.invalidate).toHaveBeenCalledWith(task.sessionID);
    });
});
