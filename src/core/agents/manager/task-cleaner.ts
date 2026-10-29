/**
 * Task Cleaner - Handles cleanup, expiration, and notifications for tasks
 * 
 * Parent notices start a model turn only when every task of the parent is done.
 */

import type { HostClient } from "../../../host/client.js";
import { TASK_STATUS, PARALLEL_TASK } from "../../../shared/index.js";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { log } from "../logger.js";
import { SessionRegistry } from "../session-registry.js";
import { buildAgentTaskCompletionMessage, buildAgentTaskProgressMessage } from "../format.js";
import type { ParallelTask } from "../../../shared/index.js";
import { finishTaskConcurrency, confirmSessionAbort } from "./task-lifecycle.js";
import { isSessionBusy } from "../../session/activity.js";
import { queueNotice } from "../../session/pending-injection.js";

export class TaskCleaner {
    private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private cleaning = new Set<string>();
    private notifying = new Set<string>();
    private timingOut = new Set<string>();
    constructor(
        private client: HostClient,
        private store: TaskStore,
        private concurrency: ConcurrencyController,
        private sessionRegistry: SessionRegistry,
    ) { }

    /**
     * PENDING tasks are not timed out here: every PENDING run is driven by
     * TaskLauncher.executeBackground, whose only wait (concurrency acquisition)
     * is bounded by its own timeout and ends in RUNNING or a task error.
     */
    pruneExpiredTasks(): void {
        const now = Date.now();
        for (const task of this.store.getAll()) {
            const age = now - task.startedAt.getTime();
            if (age > PARALLEL_TASK.TTL_MS && task.status === TASK_STATUS.RUNNING) this.startTimeout(task);
        }
    }

    /**
     * Polls and launches both prune, so an abort that has not been confirmed
     * yet would otherwise be re-fired concurrently on every pass.
     */
    private startTimeout(task: ParallelTask): void {
        if (this.timingOut.has(task.id)) return;
        log(`Timeout: ${task.id}`);
        this.timingOut.add(task.id);
        void this.timeOutRunningTask(task.id, task)
            .catch(error => log(`Timeout handling failed for ${task.id}:`, error))
            .finally(() => this.timingOut.delete(task.id));
    }

    /**
     * A running task exceeded its TTL. Mirror the poller's completion path
     * (mark terminal, free the slot, notify the parent, then hand cleanup to
     * scheduleCleanup) instead of deleting the task immediately — deleting it
     * here would make `get_task_result` return null for a task the parent was
     * just told about, and releasing the session inline duplicates the release
     * scheduleCleanup already does.
     */
    private async timeOutRunningTask(taskId: string, task: ParallelTask): Promise<void> {
        const startedAt = task.startedAt;
        if (!(await confirmSessionAbort(this.client, task.sessionID))) return;
        if (task.startedAt !== startedAt || task.status !== TASK_STATUS.RUNNING) return;
        task.status = TASK_STATUS.TIMEOUT;
        task.error = "Task exceeded time limit";
        task.completedAt = new Date();
        finishTaskConcurrency(task, this.concurrency);
        this.store.untrackPending(task.parentSessionID, taskId);

        // Tell the parent so it can re-delegate instead of idling forever.
        this.store.queueNotification(task);
        this.notifyParentIfAllComplete(task.parentSessionID).catch((error) => {
            log(`Timeout notification failed for ${taskId}:`, error);
        });

        // scheduleCleanup releases the session and deletes the task after the
        // cleanup delay, keeping it readable until then.
        this.scheduleCleanup(taskId);
    }

    scheduleCleanup(taskId: string): void {
        const task = this.store.get(taskId);
        if (!task) return;
        this.cancelCleanup(taskId);
        const sessionID = task?.sessionID;
        const startedAt = task.startedAt;

        const timer = setTimeout(async () => {
            this.cleanupTimers.delete(taskId);
            if (this.store.get(taskId) !== task || task.startedAt !== startedAt || task.status === TASK_STATUS.RUNNING || task.status === TASK_STATUS.PENDING) return;
            this.cleaning.add(taskId);
            if (sessionID) {
                try {
                    await this.sessionRegistry.release(sessionID);
                } catch (error) {
                    log(`Session cleanup error for ${sessionID}:`, error);
                }
            }
            if (task.startedAt === startedAt) this.store.delete(taskId);
            this.cleaning.delete(taskId);



            log(`Cleaned up ${taskId}`);
        }, PARALLEL_TASK.CLEANUP_DELAY_MS);
        timer.unref?.();
        this.cleanupTimers.set(taskId, timer);
    }

    cancelCleanup(taskId: string): void {
        const timer = this.cleanupTimers.get(taskId);
        if (timer) clearTimeout(timer);
        this.cleanupTimers.delete(taskId);
    }

    isCleaning(taskId: string): boolean {
        return this.cleaning.has(taskId);
    }

    shutdown(): void {
        for (const taskId of this.cleanupTimers.keys()) this.cancelCleanup(taskId);
    }

    /**
     * Notify parent session when task(s) complete.
     * Uses noReply strategy:
     * - Individual completion: noReply=true (silent notification, save tokens)
     * - All complete: noReply=false (AI should process and report results)
     */
    async notifyParentIfAllComplete(parentSessionID: string): Promise<void> {
        if (this.notifying.has(parentSessionID)) return;
        this.notifying.add(parentSessionID);
        try {
            while (this.store.getNotifications(parentSessionID).length) {
                if (!(await this.notifyBatch(parentSessionID))) break;
            }
        } finally {
            this.notifying.delete(parentSessionID);
        }
    }

    private async notifyBatch(parentSessionID: string): Promise<boolean> {
        const pendingCount = this.store.getPendingCount(parentSessionID);
        const notifications = this.store.getNotifications(parentSessionID);

        if (notifications.length === 0) return true;

        const allComplete = pendingCount === 0;
        let message: string;
        if (allComplete) {
            message = buildAgentTaskCompletionMessage(notifications);
        } else {
            message = buildAgentTaskProgressMessage(notifications, pendingCount);
        }

        if (await this.deliverToParent(parentSessionID, message, allComplete)) {
            this.store.acknowledgeNotifications(parentSessionID, notifications);
            return true;
        }
        return false;
    }

    /**
     * Send the notification, or park it if the parent is mid-turn.
     *
     * `noReply: true` is not a safe way to talk to a working session: upstream
     * still persists the user message and only skips starting a new run, so the
     * text lands inside the turn the model is already executing. A parent
     * agent is very often working while its background subagents finish, which
     * is exactly the interruption reported in issue #38.
     *
     * The notice is queued rather than dropped — which task finished is
     * information the model cannot reconstruct on its own.
     */
    private async deliverToParent(
        parentSessionID: string,
        message: string,
        allComplete: boolean,
    ): Promise<boolean> {
        if (await isSessionBusy(this.client, parentSessionID)) {
            queueNotice(parentSessionID, message);
            log(`Parent ${parentSessionID} is busy; queued task notification for the next idle`);
            return true;
        }

        try {
            await this.client.prompt({ sessionID: parentSessionID, text: message, synthetic: true, reply: allComplete });
            log(`Notified parent ${parentSessionID} (allComplete=${allComplete})`);
            return true;
        } catch (error) {
            log("Notification error:", error);
            return false;
        }
    }
}
