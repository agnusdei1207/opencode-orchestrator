import type { ParallelTask } from "../../../shared/index.js";
import type { ConcurrencyController } from "../concurrency.js";

export function finishTaskConcurrency(
    task: Pick<ParallelTask, "concurrencyKey">,
    concurrency: ConcurrencyController,
    success: boolean,
): void {
    const key = releaseTaskConcurrency(task, concurrency);
    if (!key) return;

    concurrency.reportResult(key, success);
}

export function releaseTaskConcurrency(
    task: Pick<ParallelTask, "concurrencyKey">,
    concurrency: ConcurrencyController,
): string | undefined {
    const key = task.concurrencyKey;
    if (!key) return undefined;

    concurrency.release(key);
    task.concurrencyKey = undefined;
    return key;
}
