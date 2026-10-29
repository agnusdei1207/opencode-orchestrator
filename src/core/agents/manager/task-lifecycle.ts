import type { ParallelTask } from "../../../shared/index.js";
import type { ConcurrencyController } from "../concurrency.js";
import type { HostClient } from "../../../host/client.js";
import { log } from "../logger.js";
import { withTimeout } from "../../async/with-timeout.js";

/**
 * Upper bound on waiting for the host to confirm an abort. Without it, one
 * request that never settles keeps its caller (a timeout or cancel) pending
 * forever; an unconfirmed abort is reported as not aborted and can be retried.
 */
const SESSION_ABORT_TIMEOUT_MS = 30_000;

export async function confirmSessionAbort(client: HostClient, sessionID: string): Promise<boolean> {
    try {
        return await withTimeout(
            client.interrupt(sessionID),
            SESSION_ABORT_TIMEOUT_MS,
            `Abort of session ${sessionID} was not confirmed in time`,
        );
    } catch (error) {
        log(`[ParallelAgentManager] Failed to abort session ${sessionID}:`, error);
        return false;
    }
}

/** Release the task's concurrency slot if it holds one. */
export function finishTaskConcurrency(
    task: Pick<ParallelTask, "concurrencyKey">,
    concurrency: ConcurrencyController,
): void {
    const key = task.concurrencyKey;
    if (!key) return;
    concurrency.release(key);
    task.concurrencyKey = undefined;
}
