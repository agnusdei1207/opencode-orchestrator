/**
 * Task Poller - Handles polling and completion detection for running tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TaskStore } from "../task-store.js";
import { ConcurrencyController } from "../concurrency.js";
import { CONFIG } from "../config.js";
import { log } from "../logger.js";
import { formatDuration } from "../format.js";
import type { ParallelTask } from "../interfaces/parallel-task.js";

type OpencodeClient = PluginInput["client"];

export class TaskPoller {
    private pollingInterval?: ReturnType<typeof setInterval>;

    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private concurrency: ConcurrencyController,
        private notifyParentIfAllComplete: (parentSessionID: string) => Promise<void>,
        private scheduleCleanup: (taskId: string) => void,
        private pruneExpiredTasks: () => void
    ) { }

    start(): void {
        if (this.pollingInterval) return;
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

        try {
            const statusResult = await this.client.session.status();
            const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>;

            for (const task of running) {
                try {
                    const sessionStatus = allStatuses[task.sessionID];

                    // If session is idle, try to complete
                    if (sessionStatus?.type === "idle") {
                        const elapsed = Date.now() - task.startedAt.getTime();
                        if (elapsed < CONFIG.MIN_STABILITY_MS) continue;
                        if (!(await this.validateSessionHasOutput(task.sessionID))) continue;

                        await this.completeTask(task);
                        continue;
                    }

                    // Update progress tracking
                    await this.updateTaskProgress(task);

                    // Stability detection: complete when message count stable for 3 polls
                    const elapsed = Date.now() - task.startedAt.getTime();
                    if (elapsed >= CONFIG.MIN_STABILITY_MS && task.stablePolls && task.stablePolls >= 3) {
                        if (await this.validateSessionHasOutput(task.sessionID)) {
                            log(`Task ${task.id} stable for 3 polls, completing...`);
                            await this.completeTask(task);
                        }
                    }
                } catch (error) {
                    log(`Poll error for task ${task.id}:`, error);
                }
            }
        } catch (error) {
            log("Polling error:", error);
        }
    }

    async validateSessionHasOutput(sessionID: string): Promise<boolean> {
        try {
            const response = await this.client.session.messages({ path: { id: sessionID } });
            const messages = (response.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
            return messages.some(m => m.info?.role === "assistant" && m.parts?.some(p => (p.type === "text" && p.text?.trim()) || p.type === "tool"));
        } catch {
            return true;
        }
    }

    async completeTask(task: ParallelTask): Promise<void> {
        task.status = "completed";
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
            task.concurrencyKey = undefined;
        }

        this.store.untrackPending(task.parentSessionID, task.id);
        this.store.queueNotification(task);
        await this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(task.id);

        log(`Completed ${task.id} (${formatDuration(task.startedAt, task.completedAt)})`);
    }

    private async updateTaskProgress(task: ParallelTask): Promise<void> {
        try {
            const result = await this.client.session.messages({ path: { id: task.sessionID } });
            if (result.error) return;

            const messages = (result.data ?? []) as Array<{
                info?: { role?: string };
                parts?: Array<{ type?: string; tool?: string; name?: string; text?: string }>;
            }>;

            const assistantMsgs = messages.filter(m => m.info?.role === "assistant");
            let toolCalls = 0;
            let lastTool: string | undefined;
            let lastMessage: string | undefined;

            for (const msg of assistantMsgs) {
                for (const part of msg.parts ?? []) {
                    if (part.type === "tool_use" || part.tool) {
                        toolCalls++;
                        lastTool = part.tool || part.name;
                    }
                    if (part.type === "text" && part.text) {
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
