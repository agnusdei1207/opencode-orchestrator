/**
 * Task Poller - detects when a running delegated task has finished.
 *
 * Session status comes from the host event stream (HostClient.statuses), so a
 * poll costs one message read per idle task and nothing for busy ones.
 */

import type { HostClient, HostMessage } from "../../../host/client.js";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { log } from "../logger.js";
import { formatDuration } from "../format.js";
import { finishTaskConcurrency } from "./task-lifecycle.js";
import { TASK_STATUS, PARALLEL_TASK } from "../../../shared/index.js";
import type { ParallelTask } from "../../../shared/index.js";

/** Finish reasons that mean the assistant turn has not produced a final answer. */
const NON_TERMINAL_FINISH_REASONS = ["tool-calls", "unknown", "error"];

function hasCompletedTaskOutput(message: HostMessage | undefined, task: ParallelTask | undefined): boolean {
    if (!message || !task) return false;
    if (message.created === undefined || message.created < task.startedAt.getTime()) return false;
    if (!message.completed || message.error || !message.finish) return false;
    if (NON_TERMINAL_FINISH_REASONS.includes(message.finish)) return false;
    return Boolean(message.text.trim()) || message.toolCallCount > 0;
}

interface TaskPollerOptions {
    client: HostClient;
    store: TaskStore;
    concurrency: ConcurrencyController;
    notifyParentIfAllComplete: (parentSessionID: string) => Promise<void>;
    scheduleCleanup: (taskId: string) => void;
    pruneExpiredTasks: () => void;
}

export class TaskPoller {
    private pollingTimer?: ReturnType<typeof setTimeout>;

    constructor(private readonly options: TaskPollerOptions) { }

    start(): void {
        if (this.pollingTimer) return;
        this.scheduleNextPoll();
    }

    stop(): void {
        if (!this.pollingTimer) return;
        clearTimeout(this.pollingTimer);
        this.pollingTimer = undefined;
    }

    isRunning(): boolean {
        return Boolean(this.pollingTimer);
    }

    private scheduleNextPoll(): void {
        this.pollingTimer = setTimeout(() => {
            this.poll()
                .catch(error => log("[task-poller] Scheduled poll failed", error))
                .finally(() => {
                    if (this.isRunning()) this.scheduleNextPoll();
                });
        }, PARALLEL_TASK.POLL_INTERVAL_MS);
        this.pollingTimer.unref?.();
    }

    async poll(): Promise<void> {
        this.options.pruneExpiredTasks();
        const running = this.options.store.getRunning();
        if (running.length === 0) {
            this.stop();
            return;
        }
        const statuses = this.options.client.statuses();
        for (const task of running) {
            try {
                await this.pollTask(task, statuses.get(task.sessionID));
            } catch (error) {
                log(`[task-poller] Poll failed for ${task.id}`, error);
            }
        }
    }

    private async pollTask(task: ParallelTask, sessionStatus: string | undefined): Promise<void> {
        if (task.status !== TASK_STATUS.RUNNING) return;
        // The event stream records only non-idle sessions.
        if (sessionStatus !== undefined) return;
        const startedAt = task.startedAt;
        if (Date.now() - startedAt.getTime() < PARALLEL_TASK.MIN_STABILITY_MS) return;
        if (!(await this.validateSessionHasOutput(task.sessionID, task))) return;
        if (task.startedAt === startedAt) await this.completeTask(task);
    }

    async validateSessionHasOutput(sessionID: string, task?: ParallelTask): Promise<boolean> {
        try {
            const messages = await this.options.client.messages(sessionID);
            const latest = messages.filter(message => message.role === "assistant").at(-1);
            return hasCompletedTaskOutput(latest, task ?? this.options.store.getBySession(sessionID));
        } catch (error) {
            log("[task-poller] Failed to read session output", { sessionID, error });
            return false;
        }
    }

    async completeTask(task: ParallelTask): Promise<void> {
        const { store, concurrency } = this.options;
        if (store.get(task.id) !== task || task.status !== TASK_STATUS.RUNNING) return;
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();
        finishTaskConcurrency(task, concurrency);
        store.untrackPending(task.parentSessionID, task.id);
        store.queueNotification(task);
        await this.options.notifyParentIfAllComplete(task.parentSessionID);
        this.options.scheduleCleanup(task.id);
        log(`Completed ${task.id} (${formatDuration(task.startedAt, task.completedAt)})`);
    }
}
