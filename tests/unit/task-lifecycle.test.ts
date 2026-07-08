import { describe, expect, it, vi } from "vitest";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { finishTaskConcurrency } from "../../src/core/agents/manager/task-lifecycle";
import type { ParallelTask } from "../../src/shared";

describe("task lifecycle helpers", () => {
    it("releases a task concurrency slot, reports the result, and clears the key once", async () => {
        const concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
        await concurrency.acquire("builder");
        const reportResult = vi.spyOn(concurrency, "reportResult");
        const task = { concurrencyKey: "builder" } as ParallelTask;

        finishTaskConcurrency(task, concurrency, true);
        finishTaskConcurrency(task, concurrency, false);

        expect(concurrency.getActiveCount("builder")).toBe(0);
        expect(task.concurrencyKey).toBeUndefined();
        expect(reportResult).toHaveBeenCalledTimes(1);
        expect(reportResult).toHaveBeenCalledWith("builder", true);
    });
});
