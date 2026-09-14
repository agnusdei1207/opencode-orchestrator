import type { ParallelTask } from "../../../shared/index.js";
import type { ConcurrencyController } from "../concurrency.js";
import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../logger.js";

export async function confirmSessionAbort(client: PluginInput["client"], sessionID: string): Promise<boolean> {
    try {
        const response = await client.session.abort({ path: { id: sessionID } });
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
