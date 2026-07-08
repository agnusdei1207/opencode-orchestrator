/**
 * Task Poller - Handles polling and completion detection for running tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { formatDuration } from "../format.js";
import { presets } from "../../notification/toast.js";
import { TASK_STATUS, PART_TYPES, MESSAGE_ROLES, SESSION_STATUS, AGENT_NAMES } from "../../../shared/index.js";
import type { ParallelTask } from "../../../shared/index.js";
import { progressNotifier } from "../../progress/progress-notifier.js";
import { finishTaskConcurrency } from "./task-lifecycle.js";

type OpencodeClient = PluginInput["client"];
type SessionStatusInfo = { type?: string; messageCount?: number };
type SessionMessagePart = { type?: string; tool?: string; name?: string; text?: string };
type SessionMessage = { info?: { role?: string }; parts?: SessionMessagePart[] };

const POLL_UTILIZATION_KEYS = [
    AGENT_NAMES.PLANNER,
    AGENT_NAMES.WORKER,
    AGENT_NAMES.REVIEWER,
    AGENT_NAMES.COMMANDER,
];
const TASK_POLL_FAILURE_LIMIT = 3;
const SESSION_STATUS_FAILURE_LIMIT = 3;

function hasOutputPart(part: SessionMessagePart): boolean {
    const hasText = part.type === PART_TYPES.TEXT && Boolean(part.text?.trim());
    return hasText ||
        part.type === PART_TYPES.TOOL ||
        part.type === PART_TYPES.TOOL_USE ||
        Boolean(part.tool);
}

function getReportedMessageCount(sessionInfo?: SessionStatusInfo): number | undefined {
    const messageCount = sessionInfo?.messageCount;
    return typeof messageCount === "number" && Number.isFinite(messageCount)
        ? messageCount
        : undefined;
}

export class TaskPoller {
    private pollingTimer?: ReturnType<typeof setTimeout>;
    private messageCache: Map<string, { count: number }> = new Map();
    private sessionStatusFailureCount = 0;

    // Adaptive polling
    private currentPollInterval: number = CONFIG.POLL_INTERVAL_MS; // Start at default (2000ms)
    private readonly MIN_POLL_INTERVAL = 500;  // 500ms when very busy
    private readonly MAX_POLL_INTERVAL = 5000; // 5s when idle

    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private concurrency: ConcurrencyController,
        private notifyParentIfAllComplete: (parentSessionID: string) => Promise<void>,
        private scheduleCleanup: (taskId: string) => void,
        private pruneExpiredTasks: () => void,
        private onTaskComplete?: (task: ParallelTask) => void | Promise<void>
    ) { }

    start(): void {
        if (this.pollingTimer) return;
        log("[task-poller.ts] start() - polling started (adaptive)");

        // Adaptive polling: adjust interval based on load
        this.scheduleNextPoll();
    }

    stop(): void {
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = undefined;
        }
    }

    isRunning(): boolean {
        return !!this.pollingTimer;
    }

    /**
     * Schedule next poll with adaptive interval
     */
    private scheduleNextPoll(): void {
        this.pollingTimer = setTimeout(() => {
            this.poll().then(() => {
                if (this.isRunning()) {
                    this.scheduleNextPoll();
                }
            }).catch((error) => {
                log("[task-poller.ts] Scheduled poll failed", error);
                if (this.isRunning()) {
                    this.scheduleNextPoll();
                }
            });
        }, this.currentPollInterval);

        if (this.pollingTimer?.unref) {
            this.pollingTimer.unref();
        }
    }

    async poll(): Promise<void> {
        this.pruneExpiredTasks();
        const running = this.store.getRunning();

        if (running.length === 0) {
            this.stop();
            return;
        }

        log("[task-poller.ts] poll() checking", running.length, "running tasks");

        // Adaptive interval adjustment
        this.adjustPollInterval(running.length);

        const allStatuses = await this.fetchSessionStatuses(running);
        if (!allStatuses) return;

        for (const task of running) {
            try {
                // Skip tasks that haven't actually started running yet
                if (task.status === TASK_STATUS.PENDING) continue;

                const sessionStatus = allStatuses[task.sessionID];

                // If session is idle, try to complete
                if (sessionStatus?.type === SESSION_STATUS.IDLE) {
                    const elapsed = Date.now() - task.startedAt.getTime();
                    if (elapsed < CONFIG.MIN_STABILITY_MS) continue;

                    // Smart Polling optimization: Skip heavy message check if we already know it has output
                    if (!task.hasStartedOutputting && !(await this.validateSessionHasOutput(task.sessionID, task))) {
                        this.clearTaskPollFailure(task);
                        continue;
                    }

                    await this.completeTask(task);
                    this.clearTaskPollFailure(task);
                    continue;
                }

                // Update progress tracking
                await this.updateTaskProgress(task, sessionStatus);

                // Stability detection: complete when message count stable for 3 polls
                const elapsed = Date.now() - task.startedAt.getTime();
                if (elapsed >= CONFIG.MIN_STABILITY_MS && task.stablePolls && task.stablePolls >= 3) {
                    if (task.hasStartedOutputting || await this.validateSessionHasOutput(task.sessionID, task)) {
                        log(`Task ${task.id} stable for 3 polls, completing...`);
                        await this.completeTask(task);
                    }
                }

                this.clearTaskPollFailure(task);
            } catch (error) {
                await this.handleTaskPollError(task, error);
            }
        }
        progressNotifier.update();
    }

    private async fetchSessionStatuses(running: ParallelTask[]): Promise<Record<string, SessionStatusInfo> | undefined> {
        try {
            const statusResult = await this.client.session.status();
            this.sessionStatusFailureCount = 0;
            return (statusResult.data ?? {}) as Record<string, SessionStatusInfo>;
        } catch (error) {
            this.sessionStatusFailureCount++;
            log("Polling error:", {
                error,
                consecutiveFailures: this.sessionStatusFailureCount,
                runningTasks: running.length,
            });

            if (this.sessionStatusFailureCount < SESSION_STATUS_FAILURE_LIMIT) {
                return undefined;
            }

            await Promise.all(running.map(task => this.failTaskFromPoll(
                task,
                `Session status polling failed ${this.sessionStatusFailureCount} consecutive times: ${formatError(error)}`
            )));
            this.sessionStatusFailureCount = 0;
            progressNotifier.update();
            return undefined;
        }
    }

    private async handleTaskPollError(task: ParallelTask, error: unknown): Promise<void> {
        if (task.status !== TASK_STATUS.RUNNING) {
            log(`Poll error for task ${task.id}:`, error);
            return;
        }

        task.pollFailureCount = (task.pollFailureCount ?? 0) + 1;
        log(`Poll error for task ${task.id}:`, {
            error,
            consecutiveFailures: task.pollFailureCount,
        });

        if (task.pollFailureCount < TASK_POLL_FAILURE_LIMIT) return;

        await this.failTaskFromPoll(
            task,
            `Task polling failed ${task.pollFailureCount} consecutive times: ${formatError(error)}`
        );
    }

    private clearTaskPollFailure(task: ParallelTask): void {
        task.pollFailureCount = undefined;
    }

    private async failTaskFromPoll(task: ParallelTask, message: string): Promise<void> {
        if (task.status !== TASK_STATUS.RUNNING) return;

        task.status = TASK_STATUS.ERROR;
        task.error = message;
        task.completedAt = new Date();

        finishTaskConcurrency(task, this.concurrency, false);
        this.store.untrackPending(task.parentSessionID, task.id);
        this.scheduleCleanup(task.id);
        this.messageCache.delete(task.sessionID);

        try {
            await this.notifyParentIfAllComplete(task.parentSessionID);
        } catch (error) {
            log("[task-poller.ts] Failed to notify parent after poll failure", { taskId: task.id, error });
        }

        log("[task-poller.ts] Marked task as failed after repeated poll errors", {
            taskId: task.id,
            sessionID: task.sessionID,
            error: message,
        });
    }

    async validateSessionHasOutput(sessionID: string, task?: ParallelTask): Promise<boolean> {
        try {
            const response = await this.client.session.messages({ path: { id: sessionID } });
            const messages = (response.data ?? []) as SessionMessage[];
            const hasOutput = messages.some(m =>
                m.info?.role === MESSAGE_ROLES.ASSISTANT &&
                m.parts?.some(hasOutputPart)
            );

            if (hasOutput && task) {
                task.hasStartedOutputting = true;
            }

            return hasOutput;
        } catch (error) {
            log("[task-poller.ts] Failed to validate session output", { sessionID, error });
            return false;
        }
    }

    async completeTask(task: ParallelTask): Promise<void> {
        log("[task-poller.ts] completeTask() called for", task.id, task.agent);
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();

        finishTaskConcurrency(task, this.concurrency, true);

        this.store.untrackPending(task.parentSessionID, task.id);
        this.store.queueNotification(task);
        await this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(task.id);
        this.messageCache.delete(task.sessionID);



        await this.runTaskCompleteCallback(task);

        const duration = formatDuration(task.startedAt, task.completedAt);

        // Show UI notification
        presets.sessionCompleted(task.sessionID, duration);

        log(`Completed ${task.id} (${duration})`);
        progressNotifier.update();
    }

    private async runTaskCompleteCallback(task: ParallelTask): Promise<void> {
        if (!this.onTaskComplete) return;

        try {
            await this.onTaskComplete(task);
        } catch (err) {
            log("Error in onTaskComplete callback:", err);
        }
    }

    private async updateTaskProgress(task: ParallelTask, sessionInfo?: SessionStatusInfo): Promise<void> {
        const cached = this.messageCache.get(task.sessionID);
        const reportedMsgCount = getReportedMessageCount(sessionInfo);

        if (cached && reportedMsgCount !== undefined && cached.count === reportedMsgCount) {
            // No change, skip heavy fetch
            // But still increment stable polls if needed
            task.stablePolls = (task.stablePolls ?? 0) + 1;
            return;
        }

        // Change detected or first fetch
        const result = await this.client.session.messages({ path: { id: task.sessionID } });
        if (result.error) {
            throw new Error(`Failed to fetch session messages: ${formatError(result.error)}`);
        }

        const messages = (result.data ?? []) as SessionMessage[];
        const currentMsgCount = reportedMsgCount ?? messages.length;
        const messageCountChanged = cached?.count !== currentMsgCount;

        // Update cache
        this.messageCache.set(task.sessionID, { count: currentMsgCount });

        const assistantMsgs = messages.filter(m => m.info?.role === MESSAGE_ROLES.ASSISTANT);
        let toolCalls = 0;
        let lastTool: string | undefined;
        let lastMessage: string | undefined;

        for (const msg of assistantMsgs) {
            for (const part of msg.parts ?? []) {
                if (part.type === PART_TYPES.TOOL_USE || part.tool) {
                    toolCalls++;
                    lastTool = part.tool || part.name;
                }
                if (part.type === PART_TYPES.TEXT && part.text) {
                    lastMessage = part.text;
                }
            }
        }

        // Update progress
        task.progress = {
            toolCalls,
            lastTool,
            lastMessage: lastMessage?.slice(0, 100),
            lastUpdate: new Date(),
        };

        task.stablePolls = messageCountChanged ? 0 : (task.stablePolls ?? 0) + 1;
        task.lastMsgCount = currentMsgCount;
    }

    /**
     * Adjust poll interval based on current load
     * - No tasks: Exponential backoff to MAX_POLL_INTERVAL
     * - High utilization (>80%): Speed up to MIN_POLL_INTERVAL
     * - Medium utilization: Proportional adjustment
     */
    private adjustPollInterval(runningCount: number): void {
        if (runningCount === 0) {
            // Exponential backoff when idle
            this.currentPollInterval = Math.min(
                this.currentPollInterval * 1.5,
                this.MAX_POLL_INTERVAL
            );
            return;
        }

        // Get concurrency limits and active counts
        let totalActive = 0;
        let totalLimit = 0;

        // Sample known built-in agent keys to estimate utilization.
        for (const key of POLL_UTILIZATION_KEYS) {
            const active = this.concurrency.getActiveCount(key);
            const limit = this.concurrency.getConcurrencyLimit(key);

            totalActive += active;
            totalLimit += (limit === Infinity ? 10 : limit); // Assume 10 for infinity
        }

        const utilization = totalLimit > 0 ? totalActive / totalLimit : 0;

        if (utilization > 0.8) {
            // High load - poll faster
            this.currentPollInterval = this.MIN_POLL_INTERVAL;
        } else if (utilization < 0.2) {
            // Low load - slow down
            this.currentPollInterval = Math.min(
                this.currentPollInterval * 1.2,
                this.MAX_POLL_INTERVAL
            );
        } else {
            // Medium load - proportional
            const targetInterval = this.MIN_POLL_INTERVAL +
                (this.MAX_POLL_INTERVAL - this.MIN_POLL_INTERVAL) * (1 - utilization);
            this.currentPollInterval = Math.round(targetInterval);
        }

        log(`[AdaptivePoll] Running: ${runningCount}, Utilization: ${Math.round(utilization * 100)}%, Interval: ${this.currentPollInterval}ms`);
    }
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
