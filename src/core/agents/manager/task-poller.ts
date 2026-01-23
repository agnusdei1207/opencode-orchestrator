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
import type { ParallelTask } from "../interfaces/parallel-task.interface.js";
import { TASK_STATUS, PART_TYPES, MESSAGE_ROLES, SESSION_STATUS, WAL_ACTIONS } from "../../../shared/index.js";
import { taskWAL } from "../persistence/task-wal.js";
import { progressNotifier } from "../../progress/progress-notifier.js";

type OpencodeClient = PluginInput["client"];

export class TaskPoller {
    private pollingInterval?: ReturnType<typeof setInterval>;

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
        log("[task-poller.ts] start() - polling started");
        this.pollingInterval = setInterval(() => this.poll(), CONFIG.POLL_INTERVAL_MS);
        this.pollingInterval.unref();
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

    async poll(): Promise<void> {
        this.pruneExpiredTasks();
        const running = this.store.getRunning();
        if (running.length === 0) { this.stop(); return; }
        log("[task-poller.ts] poll() checking", running.length, "running tasks");

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

        // Log to WAL
        taskWAL.log(WAL_ACTIONS.COMPLETE, task).catch(() => { });

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
            const result = await this.client.session.messages({ path: { id: task.sessionID } });
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

            // Stability detection
            const currentMsgCount = messages.length;
            if (task.lastMsgCount === currentMsgCount) {
                task.stablePolls = (task.stablePolls ?? 0) + 1;
            } else {
                task.stablePolls = 0;
            }
            task.lastMsgCount = currentMsgCount;

        } catch {
            // Ignore errors in progress tracking
        }
    }
}
