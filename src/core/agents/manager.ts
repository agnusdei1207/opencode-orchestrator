/**
 * Parallel Agent Manager
 * 
 * Session-based async agent execution with:
 * - Concurrency control per agent type
 * - Batched notifications
 * - Automatic cleanup
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { ID_PREFIX } from "../../shared/constants.js";
import { ConcurrencyController } from "./concurrency.js";
import { TaskStore } from "./task-store.js";
import { CONFIG } from "./config.js";
import { log } from "./logger.js";
import { formatDuration, buildNotificationMessage } from "./format.js";
import type { ParallelTask } from "./interfaces/parallel-task.js";
import type { LaunchInput } from "./interfaces/launch-input.js";

// Re-export
export type { ParallelTask };
export { formatDuration };

type OpencodeClient = PluginInput["client"];

export class ParallelAgentManager {
    private static _instance: ParallelAgentManager;

    private store = new TaskStore();
    private client: OpencodeClient;
    private directory: string;
    private concurrency = new ConcurrencyController();
    private pollingInterval?: ReturnType<typeof setInterval>;

    private constructor(client: OpencodeClient, directory: string) {
        this.client = client;
        this.directory = directory;
    }

    static getInstance(client?: OpencodeClient, directory?: string): ParallelAgentManager {
        if (!ParallelAgentManager._instance) {
            if (!client || !directory) {
                throw new Error("ParallelAgentManager requires client and directory on first call");
            }
            ParallelAgentManager._instance = new ParallelAgentManager(client, directory);
        }
        return ParallelAgentManager._instance;
    }

    // ========================================================================
    // Public API
    // ========================================================================

    async launch(input: LaunchInput): Promise<ParallelTask> {
        const concurrencyKey = input.agent;
        await this.concurrency.acquire(concurrencyKey);
        this.pruneExpiredTasks();

        try {
            const createResult = await this.client.session.create({
                body: { parentID: input.parentSessionID, title: `Parallel: ${input.description}` },
                query: { directory: this.directory },
            });

            if (createResult.error) {
                this.concurrency.release(concurrencyKey);
                throw new Error(`Failed to create session: ${createResult.error}`);
            }

            const sessionID = createResult.data.id;
            const taskId = `${ID_PREFIX.TASK}${crypto.randomUUID().slice(0, 8)}`;

            const task: ParallelTask = {
                id: taskId,
                sessionID,
                parentSessionID: input.parentSessionID,
                description: input.description,
                agent: input.agent,
                status: "running",
                startedAt: new Date(),
                concurrencyKey,
            };

            this.store.set(taskId, task);
            this.store.trackPending(input.parentSessionID, taskId);
            this.startPolling();

            this.client.session.prompt({
                path: { id: sessionID },
                body: { agent: input.agent, parts: [{ type: "text", text: input.prompt }] },
            }).catch((error) => {
                log(`Prompt error for ${taskId}:`, error);
                this.handleTaskError(taskId, error);
            });

            log(`Launched ${taskId} in session ${sessionID}`);
            return task;
        } catch (error) {
            this.concurrency.release(concurrencyKey);
            throw error;
        }
    }

    getTask(id: string): ParallelTask | undefined {
        return this.store.get(id);
    }

    getRunningTasks(): ParallelTask[] {
        return this.store.getRunning();
    }

    getAllTasks(): ParallelTask[] {
        return this.store.getAll();
    }

    getTasksByParent(parentSessionID: string): ParallelTask[] {
        return this.store.getByParent(parentSessionID);
    }

    async cancelTask(taskId: string): Promise<boolean> {
        const task = this.store.get(taskId);
        if (!task || task.status !== "running") return false;

        task.status = "error";
        task.error = "Cancelled by user";
        task.completedAt = new Date();

        if (task.concurrencyKey) this.concurrency.release(task.concurrencyKey);
        this.store.untrackPending(task.parentSessionID, taskId);

        try {
            await this.client.session.delete({ path: { id: task.sessionID } });
            log(`Session ${task.sessionID.slice(0, 8)}... deleted`);
        } catch {
            log(`Session ${task.sessionID.slice(0, 8)}... already gone`);
        }

        this.scheduleCleanup(taskId);
        log(`Cancelled ${taskId}`);
        return true;
    }

    async getResult(taskId: string): Promise<string | null> {
        const task = this.store.get(taskId);
        if (!task) return null;
        if (task.result) return task.result;
        if (task.status === "error") return `Error: ${task.error}`;
        if (task.status === "running") return null;

        try {
            const result = await this.client.session.messages({ path: { id: task.sessionID } });
            if (result.error) return `Error: ${result.error}`;

            const messages = (result.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
            const lastMsg = messages.filter(m => m.info?.role === "assistant").reverse()[0];
            if (!lastMsg) return "(No response)";

            const text = lastMsg.parts?.filter(p => p.type === "text" || p.type === "reasoning").map(p => p.text ?? "").filter(Boolean).join("\n") ?? "";
            task.result = text;
            return text;
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    setConcurrencyLimit(agentType: string, limit: number): void {
        this.concurrency.setLimit(agentType, limit);
    }

    getPendingCount(parentSessionID: string): number {
        return this.store.getPendingCount(parentSessionID);
    }

    cleanup(): void {
        this.stopPolling();
        this.store.clear();
    }

    formatDuration = formatDuration;

    // ========================================================================
    // Event Handling (from OpenCode hooks)
    // ========================================================================

    /**
     * Handle OpenCode session events for proper resource cleanup.
     * Call this from your plugin's event hook.
     */
    handleEvent(event: { type: string; properties?: { sessionID?: string; info?: { id?: string } } }): void {
        const props = event.properties;

        // Handle session.idle - task might be complete
        if (event.type === "session.idle") {
            const sessionID = props?.sessionID;
            if (!sessionID) return;

            const task = this.findBySession(sessionID);
            if (!task || task.status !== "running") return;

            // Validate and complete
            this.handleSessionIdle(task).catch(err => {
                log("Error handling session.idle:", err);
            });
        }

        // Handle session.deleted - cleanup resources immediately
        if (event.type === "session.deleted") {
            const sessionID = props?.info?.id ?? props?.sessionID;
            if (!sessionID) return;

            const task = this.findBySession(sessionID);
            if (!task) return;

            log(`Session deleted event for task ${task.id}`);

            // Mark as cancelled if was running
            if (task.status === "running") {
                task.status = "error";
                task.error = "Session deleted";
                task.completedAt = new Date();
            }

            // Release concurrency (with double-release prevention)
            if (task.concurrencyKey) {
                this.concurrency.release(task.concurrencyKey);
                task.concurrencyKey = undefined; // Prevent double-release
            }

            // Cleanup tracking
            this.store.untrackPending(task.parentSessionID, task.id);
            this.store.clearNotificationsForTask(task.id);
            this.store.delete(task.id);

            log(`Cleaned up deleted session task: ${task.id}`);
        }
    }

    /**
     * Find task by session ID
     */
    private findBySession(sessionID: string): ParallelTask | undefined {
        return this.store.getAll().find(t => t.sessionID === sessionID);
    }

    /**
     * Handle session.idle event - validate and complete task
     */
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
        task.status = "completed";
        task.completedAt = new Date();

        // Release concurrency (with double-release prevention)
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

    // ========================================================================
    // Internal
    // ========================================================================

    private handleTaskError(taskId: string, error: unknown): void {
        const task = this.store.get(taskId);
        if (!task) return;

        task.status = "error";
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        if (task.concurrencyKey) this.concurrency.release(task.concurrencyKey);
        this.store.untrackPending(task.parentSessionID, taskId);
        this.store.queueNotification(task);
        this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(taskId);
    }

    private startPolling(): void {
        if (this.pollingInterval) return;
        this.pollingInterval = setInterval(() => this.pollRunningTasks(), CONFIG.POLL_INTERVAL_MS);
        this.pollingInterval.unref();
    }

    private stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    private async pollRunningTasks(): Promise<void> {
        this.pruneExpiredTasks();
        const running = this.store.getRunning();
        if (running.length === 0) { this.stopPolling(); return; }

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

    /**
     * Update task progress and stability tracking
     */
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

    /**
     * Complete a task and cleanup
     */
    private async completeTask(task: ParallelTask): Promise<void> {
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

    private async validateSessionHasOutput(sessionID: string): Promise<boolean> {
        try {
            const response = await this.client.session.messages({ path: { id: sessionID } });
            const messages = (response.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
            return messages.some(m => m.info?.role === "assistant" && m.parts?.some(p => (p.type === "text" && p.text?.trim()) || p.type === "tool"));
        } catch {
            return true;
        }
    }

    private pruneExpiredTasks(): void {
        const now = Date.now();
        for (const [taskId, task] of this.store.getAll().map(t => [t.id, t] as const)) {
            const age = now - task.startedAt.getTime();
            if (age <= CONFIG.TASK_TTL_MS) continue;

            log(`Timeout: ${taskId}`);
            if (task.status === "running") {
                task.status = "timeout";
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

    private scheduleCleanup(taskId: string): void {
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

    private async notifyParentIfAllComplete(parentSessionID: string): Promise<void> {
        if (this.store.hasPending(parentSessionID)) return;

        const notifications = this.store.getNotifications(parentSessionID);
        if (notifications.length === 0) return;

        const message = buildNotificationMessage(notifications);
        try {
            await this.client.session.prompt({
                path: { id: parentSessionID },
                body: { noReply: true, parts: [{ type: "text", text: message }] },
            });
            log(`Notified parent ${parentSessionID}`);
        } catch (error) {
            log("Notification error:", error);
        }

        this.store.clearNotifications(parentSessionID);
    }
}

export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
};
