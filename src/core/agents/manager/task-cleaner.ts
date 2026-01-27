/**
 * Task Cleaner - Handles cleanup, expiration, and notifications for tasks
 * 
 * noReply Strategy:
 * - Individual task completion: noReply=true (save tokens)
 * - All tasks complete: noReply=false (let AI process results)
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TASK_STATUS, PART_TYPES } from "../../../shared/index.js";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { SessionPool } from "../session-pool.js";
import { buildNotificationMessage, formatDuration } from "../format.js";
import { getTaskToastManager, type TaskCompletionInfo } from "../../notification/task-toast-manager.js";
import * as sessionStore from "../../session/store.js";

type OpencodeClient = PluginInput["client"];

export class TaskCleaner {
    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private concurrency: ConcurrencyController,
        private sessionPool: SessionPool
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

                // Show timeout toast
                const toastManager = getTaskToastManager();
                if (toastManager) {
                    toastManager.showCompletionToast({
                        id: taskId,
                        description: task.description,
                        duration: formatDuration(task.startedAt, task.completedAt),
                        status: TASK_STATUS.ERROR,
                        error: task.error,
                    });
                }
            }

            this.sessionPool.release(task.sessionID).catch(() => { });
            sessionStore.clear(task.sessionID);
            this.store.delete(taskId);


        }
        this.store.cleanEmptyNotifications();
    }

    scheduleCleanup(taskId: string): void {
        const task = this.store.get(taskId);
        const sessionID = task?.sessionID;

        setTimeout(async () => {
            if (sessionID) {
                try {
                    await this.sessionPool.release(sessionID);
                    sessionStore.clear(sessionID);
                } catch { }
            }
            this.store.delete(taskId);



            log(`Cleaned up ${taskId}`);
        }, CONFIG.CLEANUP_DELAY_MS);
    }

    /**
     * Notify parent session when task(s) complete.
     * Uses noReply strategy:
     * - Individual completion: noReply=true (silent notification, save tokens)
     * - All complete: noReply=false (AI should process and report results)
     */
    async notifyParentIfAllComplete(parentSessionID: string): Promise<void> {
        const pendingCount = this.store.getPendingCount(parentSessionID);
        const notifications = this.store.getNotifications(parentSessionID);

        if (notifications.length === 0) return;

        const allComplete = pendingCount === 0;

        // Show toast for each completed task
        const toastManager = getTaskToastManager();
        const completionInfos: TaskCompletionInfo[] = notifications.map(task => ({
            id: task.id,
            description: task.description,
            duration: formatDuration(task.startedAt, task.completedAt),
            status: task.status as TaskCompletionInfo["status"],
            error: task.error,
        }));

        // Show individual or batch toast
        if (allComplete && completionInfos.length > 1 && toastManager) {
            toastManager.showAllCompleteToast(parentSessionID, completionInfos);
        } else if (toastManager) {
            for (const info of completionInfos) {
                toastManager.showCompletionToast(info);
            }
        }

        // Build message with different levels of detail
        let message: string;
        if (allComplete) {
            // Comprehensive summary for AI to process
            message = buildNotificationMessage(notifications);
            message += `\n\n**ACTION REQUIRED:** All background tasks are complete. ` +
                `Use \`get_task_result(taskId)\` to retrieve outputs and continue with the mission.`;
        } else {
            // Brief update - more tasks pending
            const completedCount = notifications.length;
            message = `[BACKGROUND UPDATE] ${completedCount} task(s) completed, ${pendingCount} still running.\n` +
                `Completed: ${notifications.map(t => `\`${t.id}\``).join(", ")}\n` +
                `You will be notified when ALL tasks complete. Continue productive work.`;
        }

        try {
            await this.client.session.prompt({
                path: { id: parentSessionID },
                body: {
                    // Key optimization: only trigger AI response when ALL complete
                    noReply: !allComplete,
                    parts: [{ type: PART_TYPES.TEXT, text: message }]
                },
            });
            log(`Notified parent ${parentSessionID} (allComplete=${allComplete}, noReply=${!allComplete})`);
        } catch (error) {
            log("Notification error:", error);
        }

        this.store.clearNotifications(parentSessionID);
    }
}
