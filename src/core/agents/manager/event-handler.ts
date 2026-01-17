/**
 * Event Handler - Handles OpenCode session events
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TASK_STATUS, SESSION_EVENTS } from "../../../shared/index.js";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { formatDuration } from "../format.js";
import type { ParallelTask } from "../interfaces/parallel-task.interface.js";

type OpencodeClient = PluginInput["client"];

export class EventHandler {
    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private concurrency: ConcurrencyController,
        private findBySession: (sessionID: string) => ParallelTask | undefined,
        private notifyParentIfAllComplete: (parentSessionID: string) => Promise<void>,
        private scheduleCleanup: (taskId: string) => void,
        private validateSessionHasOutput: (sessionID: string) => Promise<boolean>
    ) { }

    /**
     * Handle OpenCode session events for proper resource cleanup.
     * Call this from your plugin's event hook.
     */
    handle(event: { type: string; properties?: { sessionID?: string; info?: { id?: string } } }): void {
        const props = event.properties;

        // Handle session.idle - task might be complete
        if (event.type === SESSION_EVENTS.IDLE) {
            const sessionID = props?.sessionID;
            if (!sessionID) return;

            const task = this.findBySession(sessionID);
            if (!task || task.status !== TASK_STATUS.RUNNING) return;

            this.handleSessionIdle(task).catch(err => {
                log("Error handling session.idle:", err);
            });
        }

        // Handle session.deleted - cleanup resources immediately
        if (event.type === SESSION_EVENTS.DELETED) {
            const sessionID = props?.info?.id ?? props?.sessionID;
            if (!sessionID) return;

            const task = this.findBySession(sessionID);
            if (!task) return;

            this.handleSessionDeleted(task);
        }
    }

    private async handleSessionIdle(task: ParallelTask): Promise<void> {
        // Check minimum stability time
        const elapsed = Date.now() - task.startedAt.getTime();
        if (elapsed < CONFIG.MIN_STABILITY_MS) {
            log(`Session idle but too early for ${task.id}, waiting...`);
            return;
        }

        // Validate has actual output
        const hasOutput = await this.validateSessionHasOutput(task.sessionID);
        if (!hasOutput) {
            log(`Session idle but no output for ${task.id}, waiting...`);
            return;
        }

        // Mark complete
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();

        // Release concurrency
        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
            task.concurrencyKey = undefined;
        }

        // Cleanup and notify
        this.store.untrackPending(task.parentSessionID, task.id);
        this.store.queueNotification(task);
        await this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(task.id);

        log(`Task ${task.id} completed via session.idle event (${formatDuration(task.startedAt, task.completedAt)})`);
    }

    private handleSessionDeleted(task: ParallelTask): void {
        log(`Session deleted event for task ${task.id}`);

        // Mark as cancelled if was running
        if (task.status === TASK_STATUS.RUNNING) {
            task.status = TASK_STATUS.ERROR;
            task.error = "Session deleted";
            task.completedAt = new Date();
        }

        // Release concurrency
        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
            task.concurrencyKey = undefined;
        }

        // Cleanup tracking
        this.store.untrackPending(task.parentSessionID, task.id);
        this.store.clearNotificationsForTask(task.id);
        this.store.delete(task.id);

        log(`Cleaned up deleted session task: ${task.id}`);
    }
}
