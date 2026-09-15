/**
 * Event Handler - Handles OpenCode session events
 */

import { TASK_STATUS, SESSION_EVENTS } from "../../../shared/index.js";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { formatDuration } from "../format.js";
import type { ParallelTask } from "../../../shared/index.js";
import { finishTaskConcurrency } from "./task-lifecycle.js";

interface EventHandlerOptions {
    store: TaskStore;
    concurrency: ConcurrencyController;
    findBySession: (sessionID: string) => ParallelTask | undefined;
    notifyParentIfAllComplete: (parentSessionID: string) => Promise<void>;
    scheduleCleanup: (taskId: string) => void;
    validateSessionHasOutput: (sessionID: string) => Promise<boolean>;
    forgetSession?: (sessionID: string) => void;
}

export class EventHandler {
    private readonly store: TaskStore;
    private readonly concurrency: ConcurrencyController;
    private readonly findBySession: EventHandlerOptions["findBySession"];
    private readonly notifyParentIfAllComplete: EventHandlerOptions["notifyParentIfAllComplete"];
    private readonly scheduleCleanup: (taskId: string) => void;
    private readonly validateSessionHasOutput: EventHandlerOptions["validateSessionHasOutput"];
    private readonly forgetSession?: (sessionID: string) => void;

    constructor(options: EventHandlerOptions) {
        this.store = options.store;
        this.concurrency = options.concurrency;
        this.findBySession = options.findBySession;
        this.notifyParentIfAllComplete = options.notifyParentIfAllComplete;
        this.scheduleCleanup = options.scheduleCleanup;
        this.validateSessionHasOutput = options.validateSessionHasOutput;
        this.forgetSession = options.forgetSession;
    }

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
            const sessionID = readSessionID(props);
            if (!sessionID) return;

            const task = this.findBySession(sessionID);
            if (!task) return;

            this.handleSessionDeleted(task).catch(err => {
                log("Error handling session.deleted:", err);
            });
        }
    }

    private async handleSessionIdle(task: ParallelTask): Promise<void> {
        const startedAt = task.startedAt;
        // Check minimum stability time
        const elapsed = Date.now() - task.startedAt.getTime();
        if (elapsed < CONFIG.MIN_STABILITY_MS) {
            log(`Session idle but too early for ${task.id}, waiting...`);
            return;
        }

        // Validate has actual output
        const hasOutput = await this.validateSessionHasOutput(task.sessionID);
        if (this.store.get(task.id) !== task || task.status !== TASK_STATUS.RUNNING || task.startedAt !== startedAt) return;
        if (!hasOutput) {
            log(`Session idle but no output for ${task.id}, waiting...`);
            return;
        }

        // Mark complete
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();

        finishTaskConcurrency(task, this.concurrency, true);

        // Cleanup and notify
        this.store.untrackPending(task.parentSessionID, task.id);
        this.store.queueNotification(task);
        await this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(task.id);
        log(`Task ${task.id} completed via session.idle event (${formatDuration(task.startedAt, task.completedAt)})`);
    }

    /**
     * The host deleted a task's session (a user removing it in the TUI, or a
     * pool deletion that raced the task). A task that was still running dies
     * here, and its parent must hear about it: nothing else fires when the
     * last pending task disappears this way, so without a notice the parent
     * waits forever on a result that will never arrive (issue #41).
     */
    private async handleSessionDeleted(task: ParallelTask): Promise<void> {
        log(`Session deleted event for task ${task.id}`);

        const diedRunning = task.status === TASK_STATUS.RUNNING || task.status === TASK_STATUS.PENDING;
        if (diedRunning) {
            task.status = TASK_STATUS.ERROR;
            task.error = "Session deleted";
            task.completedAt = new Date();
        }

        finishTaskConcurrency(task, this.concurrency, false);

        // Cleanup tracking
        this.store.untrackPending(task.parentSessionID, task.id);
        if (diedRunning) {
            // Keep the errored task readable for `get_task_result` until the
            // regular cleanup delay, like any other failed task.
            this.store.queueNotification(task);
            this.scheduleCleanup(task.id);
        } else {
            this.store.clearNotificationsForTask(task.id);
            this.store.delete(task.id);
        }

        // The server already removed the session; the pool only has to forget it.
        this.forgetSession?.(task.sessionID);

        if (diedRunning) {
            await this.notifyParentIfAllComplete(task.parentSessionID);
        }

        log(`Cleaned up deleted session task: ${task.id}`);
    }
}

function readSessionID(properties: { sessionID?: string; info?: { id?: string } } | undefined): string | undefined {
    return properties?.sessionID || properties?.info?.id;
}
