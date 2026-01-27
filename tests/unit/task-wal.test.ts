import { describe, it, expect } from "vitest";
import { TaskWAL } from "../../src/core/agents/persistence/task-wal";
import { TASK_STATUS } from "../../src/shared/index";
import type { ParallelTask } from "../../src/core/agents/interfaces/parallel-task.interface";

describe("TaskWAL (disabled)", () => {
    const mockTask: ParallelTask = {
        id: "task_1",
        sessionID: "session_1",
        parentSessionID: "parent_1",
        description: "Test task",
        agent: "builder",
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(),
        depth: 1,
        prompt: "Do something"
    };

    it("should be a no-op for all operations", async () => {
        const wal = new TaskWAL();

        // All methods should complete without error
        await wal.init();
        await wal.log("LAUNCH", mockTask);
        await wal.flush();
        await wal.compact([mockTask]);

        // readAll should return empty map
        const tasks = await wal.readAll();
        expect(tasks.size).toBe(0);
    });
});
