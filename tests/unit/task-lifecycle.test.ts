import { describe, expect, it, vi } from "vitest";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { confirmSessionAbort, finishTaskConcurrency } from "../../src/core/agents/manager/task-lifecycle";
import type { ParallelTask } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("task lifecycle helpers", () => {
    it("releases a task concurrency slot and clears the key once", async () => {
        const concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
        await concurrency.acquire("builder");
        const release = vi.spyOn(concurrency, "release");
        const task = { concurrencyKey: "builder" } as ParallelTask;

        finishTaskConcurrency(task, concurrency);
        finishTaskConcurrency(task, concurrency);

        expect(concurrency.getActiveCount("builder")).toBe(0);
        expect(task.concurrencyKey).toBeUndefined();
        expect(release).toHaveBeenCalledTimes(1);
        expect(release).toHaveBeenCalledWith("builder");
    });

    it("confirms an abort only when the host interrupt confirms it", async () => {
        const client = { interrupt: vi.fn().mockResolvedValue(true) };
        await expect(confirmSessionAbort(client as never, "s1")).resolves.toBe(true);
        expect(client.interrupt).toHaveBeenCalledWith("s1");

        client.interrupt.mockResolvedValueOnce(false);
        await expect(confirmSessionAbort(client as never, "s1")).resolves.toBe(false);

        client.interrupt.mockRejectedValueOnce(new Error("network"));
        await expect(confirmSessionAbort(client as never, "s1")).resolves.toBe(false);
    });
});
