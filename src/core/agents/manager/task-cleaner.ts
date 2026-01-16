/**
 * Task Cleaner - Handles cleanup and expiration of tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TASK_STATUS, PART_TYPES } from "../../../shared/constants.js";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { buildNotificationMessage } from "../format.js";

type OpencodeClient = PluginInput["client"];

export class TaskCleaner {
    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private concurrency: ConcurrencyController
    ) { }

    pruneExpiredTasks(): void {
        const now = Date.now();
        for (const [taskId, task] of this.store.getAll().map(t => [t.id, t] as const)) {
            const age = now - task.startedAt.getTime();
            if (age <= CONFIG.TASK_TTL_MS) continue;

            log(`Timeout: ${taskId}`);
            if (task.status === TASK_STATUS.RUNNING) {
                task.status = TASK_STATUS.TIMEOUT;
                task.error = "Task exceeded 30 minute time limit";
                task.completedAt = new Date();
                if (task.concurrencyKey) this.concurrency.release(task.concurrencyKey);
                this.store.untrackPending(task.parentSessionID, taskId);
            }

            this.client.session.delete({ path: { id: task.sessionID } }).catch(() => { });
            this.store.delete(taskId);
        }
        this.store.cleanEmptyNotifications();
    }

    scheduleCleanup(taskId: string): void {
        const task = this.store.get(taskId);
        const sessionID = task?.sessionID;

        setTimeout(async () => {
            if (sessionID) {
                try { await this.client.session.delete({ path: { id: sessionID } }); } catch { }
            }
            this.store.delete(taskId);
            log(`Cleaned up ${taskId}`);
        }, CONFIG.CLEANUP_DELAY_MS);
    }

    async notifyParentIfAllComplete(parentSessionID: string): Promise<void> {
        if (this.store.hasPending(parentSessionID)) return;

        const notifications = this.store.getNotifications(parentSessionID);
        if (notifications.length === 0) return;

        const message = buildNotificationMessage(notifications);
        try {
            await this.client.session.prompt({
                path: { id: parentSessionID },
                body: { noReply: true, parts: [{ type: PART_TYPES.TEXT, text: message }] },
            });
            log(`Notified parent ${parentSessionID}`);
        } catch (error) {
            log("Notification error:", error);
        }

        this.store.clearNotifications(parentSessionID);
    }
}
