import { describe, expect, it, vi } from "vitest";
import { WorkStealingWorkerPool } from "../../src/core/queue/worker-pool";

describe("WorkStealingWorkerPool", () => {
    it("rejects invalid worker counts at construction time", () => {
        const executor = vi.fn().mockResolvedValue(undefined);

        expect(() => new WorkStealingWorkerPool(0, executor)).toThrow("at least one worker");
        expect(() => new WorkStealingWorkerPool(-1, executor)).toThrow("at least one worker");
        expect(() => new WorkStealingWorkerPool(1.5, executor)).toThrow("at least one worker");
    });

    it("executes submitted work after start", async () => {
        const executed: string[] = [];
        const pool = new WorkStealingWorkerPool<string>(1, async (item) => {
            executed.push(item.task);
        });

        pool.start();
        pool.submit("task-a");

        await vi.waitFor(() => {
            expect(executed).toEqual(["task-a"]);
        });
        await pool.stop();
    });
});
