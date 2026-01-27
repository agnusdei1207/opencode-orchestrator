/**
 * Task Poller - Handles polling and completion detection for running tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { formatDuration } from "../format.js";
import { presets } from "../../../shared/index.js";
import type { ParallelTask } from "../interfaces/index.js";
import { TASK_STATUS, PART_TYPES, MESSAGE_ROLES, SESSION_STATUS } from "../../../shared/index.js";
import { progressNotifier } from "../../progress/progress-notifier.js";

type OpencodeClient = PluginInput["client"];

export class TaskPoller {
    private pollingInterval?: ReturnType<typeof setInterval>;
    private messageCache: Map<string, { count: number; lastChecked: Date }> = new Map();

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
        if (this.pollingInterval) return;
        log("[task-poller.ts] start() - polling started (adaptive)");

        // Adaptive polling: adjust interval based on load
        this.scheduleNextPoll();
    }

    stop(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    isRunning(): boolean {
        return !!this.pollingInterval;
    }

    /**
     * Schedule next poll with adaptive interval
     */
    private scheduleNextPoll(): void {
        this.pollingInterval = setTimeout(() => {
            this.poll().then(() => {
                if (this.isRunning()) {
                    this.scheduleNextPoll();
                }
            });
        }, this.currentPollInterval) as ReturnType<typeof setInterval>;

        if (this.pollingInterval?.unref) {
            this.pollingInterval.unref();
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

        try {
            const statusResult = await this.client.session.status();
            const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>;

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
                        if (!task.hasStartedOutputting && !(await this.validateSessionHasOutput(task.sessionID, task))) continue;

                        await this.completeTask(task);
                        continue;
                    }

                    // Update progress tracking
                    await this.updateTaskProgress(task);

                    // Stability detection: complete when message count stable for 3 polls
                    const elapsed = Date.now() - task.startedAt.getTime();
                    if (elapsed >= CONFIG.MIN_STABILITY_MS && task.stablePolls && task.stablePolls >= 3) {
                        if (task.hasStartedOutputting || await this.validateSessionHasOutput(task.sessionID, task)) {
                            log(`Task ${task.id} stable for 3 polls, completing...`);
                            await this.completeTask(task);
                        }
                    }
                } catch (error) {
                    log(`Poll error for task ${task.id}:`, error);
                }
            }
            progressNotifier.update();
        } catch (error) {
            log("Polling error:", error);
        }
    }

    async validateSessionHasOutput(sessionID: string, task?: ParallelTask): Promise<boolean> {
        try {
            const response = await this.client.session.messages({ path: { id: sessionID } });
            const messages = (response.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
            const hasOutput = messages.some(m => m.info?.role === MESSAGE_ROLES.ASSISTANT && m.parts?.some(p => (p.type === PART_TYPES.TEXT && p.text?.trim()) || p.type === PART_TYPES.TOOL));

            if (hasOutput && task) {
                task.hasStartedOutputting = true;
            }

            return hasOutput;
        } catch {
            return true;
        }
    }

    async completeTask(task: ParallelTask): Promise<void> {
        log("[task-poller.ts] completeTask() called for", task.id, task.agent);
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
            this.concurrency.reportResult(task.concurrencyKey, true); // Report success
            task.concurrencyKey = undefined;
        }

        this.store.untrackPending(task.parentSessionID, task.id);
        this.store.queueNotification(task);
        await this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(task.id);



        // HPFA Trigger: Pipelined Review
        if (this.onTaskComplete) {
            Promise.resolve(this.onTaskComplete(task)).catch(err => log("Error in onTaskComplete callback:", err));
        }

        const duration = formatDuration(task.startedAt, task.completedAt);

        // Show UI notification
        presets.sessionCompleted(task.sessionID, duration);

        log(`Completed ${task.id} (${duration})`);
        progressNotifier.update();
    }

    private async updateTaskProgress(task: ParallelTask): Promise<void> {
        try {
            const cached = this.messageCache.get(task.sessionID);

            // OPTION C: Check status first (lightweight) before fetching messages (heavy)
            const statusResult = await this.client.session.status();
            const sessionInfo = (statusResult.data as Record<string, { messageCount?: number }>)?.[task.sessionID];
            const currentMsgCount = sessionInfo?.messageCount ?? 0;

            if (cached && cached.count === currentMsgCount) {
                // No change, skip heavy fetch
                // But still increment stable polls if needed
                task.stablePolls = (task.stablePolls ?? 0) + 1;
                return;
            }

            // Change detected or first fetch
            const result = await this.client.session.messages({ path: { id: task.sessionID } });
            // Update cache
            this.messageCache.set(task.sessionID, { count: currentMsgCount, lastChecked: new Date() });

            if (result.error) return;

            const messages = (result.data ?? []) as Array<{
                info?: { role?: string };
                parts?: Array<{ type?: string; tool?: string; name?: string; text?: string }>;
            }>;

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

            // Stability detection handled via cache check above or here
            if (task.lastMsgCount === currentMsgCount) {
                // Redundant if handled by cache check, but safe to keep logic consistent
                // Actually if cache hit, we returned early.
                // If we are here, it means things CHANGED.
                task.stablePolls = 0;
            } else {
                task.stablePolls = 0;
            }
            task.lastMsgCount = currentMsgCount;

        } catch {
            // Ignore errors in progress tracking
        }
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

        // Sample a few concurrency keys to estimate utilization
        for (const key of ["planner", "worker", "reviewer", "commander"]) {
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
