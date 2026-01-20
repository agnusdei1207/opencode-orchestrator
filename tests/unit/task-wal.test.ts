import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TaskWAL } from "../../src/core/agents/persistence/task-wal";
import { WAL_ACTIONS, TASK_STATUS } from "../../src/shared/index";
import type { ParallelTask } from "../../src/core/agents/interfaces/parallel-task.interface";

describe("TaskWAL", () => {
    const testWalPath = path.resolve(process.cwd(), "test_tasks.jsonl");
    let wal: TaskWAL;

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

    beforeEach(async () => {
        wal = new TaskWAL(testWalPath);
        await wal.init();
    });

    afterEach(async () => {
        try {
            await fs.unlink(testWalPath);
        } catch { }
    });

    it("should log a LAUNCH action", async () => {
        await wal.log(WAL_ACTIONS.LAUNCH, mockTask);
        const tasks = await wal.readAll();

        expect(tasks.size).toBe(1);
        const task = tasks.get("task_1");
        expect(task?.id).toBe("task_1");
        expect(task?.status).toBe(TASK_STATUS.RUNNING);
    });

    it("should log an UPDATE action", async () => {
        await wal.log(WAL_ACTIONS.LAUNCH, mockTask);

        const updatedTask = { ...mockTask, status: TASK_STATUS.COMPLETED };
        await wal.log(WAL_ACTIONS.UPDATE, updatedTask);

        const tasks = await wal.readAll();
        expect(tasks.get("task_1")?.status).toBe(TASK_STATUS.COMPLETED);
    });

    it("should log a DELETE action", async () => {
        await wal.log(WAL_ACTIONS.LAUNCH, mockTask);
        await wal.log(WAL_ACTIONS.DELETE, mockTask);

        const tasks = await wal.readAll();
        expect(tasks.has("task_1")).toBe(false);
    });

    it("should reconstruct state from multi-line WAL", async () => {
        await wal.log(WAL_ACTIONS.LAUNCH, mockTask);
        await wal.log(WAL_ACTIONS.UPDATE, { ...mockTask, status: TASK_STATUS.COMPLETED });

        const secondTask: ParallelTask = {
            ...mockTask,
            id: "task_2",
            sessionID: "session_2"
        };
        await wal.log(WAL_ACTIONS.LAUNCH, secondTask);

        const tasks = await wal.readAll();
        expect(tasks.size).toBe(2);
        expect(tasks.get("task_1")?.status).toBe(TASK_STATUS.COMPLETED);
        expect(tasks.get("task_2")?.id).toBe("task_2");
    });

    it("should compact the WAL", async () => {
        await wal.log(WAL_ACTIONS.LAUNCH, mockTask);
        await wal.log(WAL_ACTIONS.UPDATE, { ...mockTask, status: TASK_STATUS.COMPLETED });

        const activeTasks = [{ ...mockTask, status: TASK_STATUS.COMPLETED }];
        await wal.compact(activeTasks);

        // After compaction, the file should only have 1 line (the active task)
        const content = await fs.readFile(testWalPath, "utf-8");
        const lines = content.split("\n").filter(Boolean);
        expect(lines.length).toBe(1);

        const tasks = await wal.readAll();
        expect(tasks.size).toBe(1);
        expect(tasks.get("task_1")?.status).toBe(TASK_STATUS.COMPLETED);
    });
});
