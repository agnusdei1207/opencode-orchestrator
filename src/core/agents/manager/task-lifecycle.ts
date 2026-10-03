import type { ParallelTask } from "../../../shared/index.js";
import type { ConcurrencyController } from "../concurrency.js";
import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../logger.js";
import { withTimeout } from "../../async/with-timeout.js";

/**
 * Upper bound on waiting for the host to confirm an abort. Without it, one
 * request that never settles keeps its caller (a timeout or cancel) pending
 * forever; an unconfirmed abort is reported as not aborted and can be retried.
 */
export const SESSION_ABORT_TIMEOUT_MS = 30_000;

export async function confirmSessionAbort(client: PluginInput["client"], sessionID: string): Promise<boolean> {
    try {
        const response = await withTimeout(
            client.session.abort({ path: { id: sessionID } }),
            SESSION_ABORT_TIMEOUT_MS,
            `Abort of session ${sessionID} was not confirmed in time`,
        );
        return !response.error && response.data === true;
    } catch (error) {
        log(`[ParallelAgentManager] Failed to abort session ${sessionID}:`, error);
        return false;
    }
}

export function finishTaskConcurrency(
    task: Pick<ParallelTask, "concurrencyKey">,
    concurrency: ConcurrencyController,
    success: boolean,
): void {
    const key = releaseTaskConcurrency(task, concurrency);
    if (!key) return;

    concurrency.reportResult(key, success);
}

function releaseTaskConcurrency(
    task: Pick<ParallelTask, "concurrencyKey">,
    concurrency: ConcurrencyController,
): string | undefined {
    const key = task.concurrencyKey;
    if (!key) return undefined;

    concurrency.release(key);
    task.concurrencyKey = undefined;
    return key;
}
