/**
 * Parallel Agent Manager - Session-based async agent execution
 * 
 * Key safety features:
 * - Concurrency control per agent type (queue-based)
 * - Batched notifications (notify when ALL complete)
 * - Automatic memory cleanup (5 min after completion)
 * - TTL enforcement (30 min timeout)
 * - Output validation before completion
 * - Process-safe polling (unref)
 */

import type { PluginInput } from "@opencode-ai/plugin";

// Configuration
const TASK_TTL_MS = 30 * 60 * 1000;           // 30 minutes max runtime
const CLEANUP_DELAY_MS = 5 * 60 * 1000;       // 5 min after completion
const MIN_STABILITY_MS = 5 * 1000;            // Minimum 5s before completion
const POLL_INTERVAL_MS = 2000;                // Poll every 2s
const DEFAULT_CONCURRENCY = 3;                // Default max parallel per agent type

// Debug logger
const DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";
const log = (...args: unknown[]) => {
    if (DEBUG) console.log("[parallel-agent]", ...args);
};

type OpencodeClient = PluginInput["client"];

// ============================================================================
// Types
// ============================================================================

export interface ParallelTask {
    id: string;
    sessionID: string;
    parentSessionID: string;
    description: string;
    agent: string;
    status: "pending" | "running" | "completed" | "error" | "timeout";
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    result?: string;
    concurrencyKey?: string;
}

interface LaunchInput {
    description: string;
    prompt: string;
    agent: string;
    parentSessionID: string;
}

// ============================================================================
// Concurrency Controller - Queue-based rate limiting per agent type
// ============================================================================

class ConcurrencyController {
    private counts: Map<string, number> = new Map();
    private queues: Map<string, Array<() => void>> = new Map();
    private limits: Map<string, number> = new Map();

    setLimit(key: string, limit: number): void {
        this.limits.set(key, limit);
    }

    getLimit(key: string): number {
        return this.limits.get(key) ?? DEFAULT_CONCURRENCY;
    }

    async acquire(key: string): Promise<void> {
        const limit = this.getLimit(key);
        if (limit === 0) return; // 0 = unlimited

        const current = this.counts.get(key) ?? 0;
        if (current < limit) {
            this.counts.set(key, current + 1);
            log(`Acquired slot for ${key}: ${current + 1}/${limit}`);
            return;
        }

        // Queue and wait
        log(`Queueing for ${key}: ${current}/${limit} (waiting...)`);
        return new Promise<void>((resolve) => {
            const queue = this.queues.get(key) ?? [];
            queue.push(resolve);
            this.queues.set(key, queue);
        });
    }

    release(key: string): void {
        const limit = this.getLimit(key);
        if (limit === 0) return;

        const queue = this.queues.get(key);
        if (queue && queue.length > 0) {
            const next = queue.shift()!;
            log(`Released slot for ${key}: next in queue`);
            next();
        } else {
            const current = this.counts.get(key) ?? 0;
            if (current > 0) {
                this.counts.set(key, current - 1);
                log(`Released slot for ${key}: ${current - 1}`);
            }
        }
    }

    getQueueLength(key: string): number {
        return this.queues.get(key)?.length ?? 0;
    }
}

// ============================================================================
// Parallel Agent Manager
// ============================================================================

export class ParallelAgentManager {
    private static _instance: ParallelAgentManager;

    // Core state
    private tasks: Map<string, ParallelTask> = new Map();
    private pendingByParent: Map<string, Set<string>> = new Map();
    private notifications: Map<string, ParallelTask[]> = new Map();

    // Dependencies
    private client: OpencodeClient;
    private directory: string;
    private concurrency: ConcurrencyController;

    // Polling
    private pollingInterval?: ReturnType<typeof setInterval>;

    private constructor(client: OpencodeClient, directory: string) {
        this.client = client;
        this.directory = directory;
        this.concurrency = new ConcurrencyController();
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

    /**
     * Launch an agent in a new session (async, non-blocking)
     */
    async launch(input: LaunchInput): Promise<ParallelTask> {
        const concurrencyKey = input.agent;

        // Wait for available slot (queued if at limit)
        await this.concurrency.acquire(concurrencyKey);

        // Prune expired tasks before launching
        this.pruneExpiredTasks();

        try {
            // Create child session
            const createResult = await this.client.session.create({
                body: {
                    parentID: input.parentSessionID,
                    title: `Parallel: ${input.description}`,
                },
                query: {
                    directory: this.directory,
                },
            });

            if (createResult.error) {
                this.concurrency.release(concurrencyKey);
                throw new Error(`Failed to create session: ${createResult.error}`);
            }

            const sessionID = createResult.data.id;
            const taskId = `task_${crypto.randomUUID().slice(0, 8)}`;

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

            this.tasks.set(taskId, task);
            this.trackPending(input.parentSessionID, taskId);
            this.startPolling();

            // Fire-and-forget: Start agent prompt
            this.client.session.prompt({
                path: { id: sessionID },
                body: {
                    agent: input.agent,
                    parts: [{ type: "text", text: input.prompt }],
                },
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

    /**
     * Get task by ID
     */
    getTask(id: string): ParallelTask | undefined {
        return this.tasks.get(id);
    }

    /**
     * Get all running tasks
     */
    getRunningTasks(): ParallelTask[] {
        return Array.from(this.tasks.values()).filter(t => t.status === "running");
    }

    /**
     * Get all tasks
     */
    getAllTasks(): ParallelTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get tasks by parent session
     */
    getTasksByParent(parentSessionID: string): ParallelTask[] {
        return Array.from(this.tasks.values())
            .filter(t => t.parentSessionID === parentSessionID);
    }

    /**
     * Cancel a running task
     */
    async cancelTask(taskId: string): Promise<boolean> {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== "running") {
            return false;
        }

        task.status = "error";
        task.error = "Cancelled by user";
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
        }

        this.untrackPending(task.parentSessionID, taskId);

        // Delete session
        try {
            await this.client.session.delete({
                path: { id: task.sessionID },
            });
        } catch {
            // Ignore
        }

        this.scheduleCleanup(taskId);
        console.log(`[parallel] 🛑 CANCELLED ${taskId}`);
        log(`Cancelled ${taskId}`);
        return true;
    }

    /**
     * Get result from completed task
     */
    async getResult(taskId: string): Promise<string | null> {
        const task = this.tasks.get(taskId);
        if (!task) return null;
        if (task.result) return task.result;
        if (task.status === "error") return `Error: ${task.error}`;
        if (task.status === "running") return null;

        try {
            const messagesResult = await this.client.session.messages({
                path: { id: task.sessionID },
            });

            if (messagesResult.error) {
                return `Error: ${messagesResult.error}`;
            }

            const messages = (messagesResult.data ?? []) as Array<{
                info?: { role?: string };
                parts?: Array<{ type?: string; text?: string }>;
            }>;

            const assistantMsgs = messages
                .filter(m => m.info?.role === "assistant")
                .reverse();

            const lastMsg = assistantMsgs[0];
            if (!lastMsg) return "(No response)";

            const textParts = lastMsg.parts?.filter(p =>
                p.type === "text" || p.type === "reasoning"
            ) ?? [];

            const result = textParts.map(p => p.text ?? "").filter(Boolean).join("\n");
            task.result = result;
            return result;
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    /**
     * Set concurrency limit for agent type
     */
    setConcurrencyLimit(agentType: string, limit: number): void {
        this.concurrency.setLimit(agentType, limit);
    }

    /**
     * Get pending notification count
     */
    getPendingCount(parentSessionID: string): number {
        return this.pendingByParent.get(parentSessionID)?.size ?? 0;
    }

    /**
     * Cleanup all state
     */
    cleanup(): void {
        this.stopPolling();
        this.tasks.clear();
        this.pendingByParent.clear();
        this.notifications.clear();
    }

    // ========================================================================
    // Internal: Tracking
    // ========================================================================

    private trackPending(parentSessionID: string, taskId: string): void {
        const pending = this.pendingByParent.get(parentSessionID) ?? new Set();
        pending.add(taskId);
        this.pendingByParent.set(parentSessionID, pending);
    }

    private untrackPending(parentSessionID: string, taskId: string): void {
        const pending = this.pendingByParent.get(parentSessionID);
        if (pending) {
            pending.delete(taskId);
            if (pending.size === 0) {
                this.pendingByParent.delete(parentSessionID);
            }
        }
    }

    // ========================================================================
    // Internal: Error Handling
    // ========================================================================

    private handleTaskError(taskId: string, error: unknown): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.status = "error";
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
        }

        this.untrackPending(task.parentSessionID, taskId);
        this.queueNotification(task);
        this.notifyParentIfAllComplete(task.parentSessionID);
        this.scheduleCleanup(taskId);
    }

    // ========================================================================
    // Internal: Polling
    // ========================================================================

    private startPolling(): void {
        if (this.pollingInterval) return;

        this.pollingInterval = setInterval(() => {
            this.pollRunningTasks();
        }, POLL_INTERVAL_MS);

        // Allow Node.js to exit even if polling is running
        this.pollingInterval.unref();
    }

    private stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    private async pollRunningTasks(): Promise<void> {
        // Prune expired tasks first
        this.pruneExpiredTasks();

        const runningTasks = this.getRunningTasks();
        if (runningTasks.length === 0) {
            this.stopPolling();
            return;
        }

        try {
            const statusResult = await this.client.session.status();
            const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>;

            for (const task of runningTasks) {
                const sessionStatus = allStatuses[task.sessionID];

                if (sessionStatus?.type === "idle") {
                    // Verify minimum run time
                    const elapsed = Date.now() - task.startedAt.getTime();
                    if (elapsed < MIN_STABILITY_MS) continue;

                    // Validate session has actual output
                    const hasOutput = await this.validateSessionHasOutput(task.sessionID);
                    if (!hasOutput) continue;

                    // Mark completed
                    task.status = "completed";
                    task.completedAt = new Date();

                    if (task.concurrencyKey) {
                        this.concurrency.release(task.concurrencyKey);
                    }

                    this.untrackPending(task.parentSessionID, task.id);
                    this.queueNotification(task);
                    this.notifyParentIfAllComplete(task.parentSessionID);
                    this.scheduleCleanup(task.id);

                    const duration = this.formatDuration(task.startedAt, task.completedAt);
                    console.log(`[parallel] ✅ COMPLETED ${task.id} → ${task.agent}: ${task.description} (${duration})`);
                    log(`Completed ${task.id}`);
                }
            }
        } catch (error) {
            log("Polling error:", error);
        }
    }

    // ========================================================================
    // Internal: Validation
    // ========================================================================

    private async validateSessionHasOutput(sessionID: string): Promise<boolean> {
        try {
            const response = await this.client.session.messages({
                path: { id: sessionID },
            });

            const messages = (response.data ?? []) as Array<{
                info?: { role?: string };
                parts?: Array<{ type?: string; text?: string }>;
            }>;

            // Check for assistant message with content
            const hasContent = messages.some(m => {
                if (m.info?.role !== "assistant") return false;
                const parts = m.parts ?? [];
                return parts.some(p =>
                    (p.type === "text" && p.text?.trim()) ||
                    (p.type === "reasoning" && p.text?.trim()) ||
                    p.type === "tool"
                );
            });

            return hasContent;
        } catch {
            // On error, allow completion
            return true;
        }
    }

    // ========================================================================
    // Internal: Cleanup & TTL
    // ========================================================================

    private pruneExpiredTasks(): void {
        const now = Date.now();

        for (const [taskId, task] of this.tasks.entries()) {
            const age = now - task.startedAt.getTime();

            if (age > TASK_TTL_MS) {
                log(`Timeout: ${taskId} (${Math.round(age / 1000)}s)`);

                if (task.status === "running") {
                    task.status = "timeout";
                    task.error = "Task exceeded 30 minute time limit";
                    task.completedAt = new Date();

                    if (task.concurrencyKey) {
                        this.concurrency.release(task.concurrencyKey);
                    }

                    this.untrackPending(task.parentSessionID, taskId);
                    console.log(`[parallel] ⏱️ TIMEOUT ${taskId} → ${task.agent}: ${task.description}`);
                }

                // Delete session from OpenCode
                this.client.session.delete({
                    path: { id: task.sessionID },
                }).catch(() => { /* ignore */ });

                // Remove immediately on timeout
                this.tasks.delete(taskId);
            }
        }

        // Clean empty notification queues
        for (const [sessionID, queue] of this.notifications.entries()) {
            if (queue.length === 0) {
                this.notifications.delete(sessionID);
            }
        }
    }

    private scheduleCleanup(taskId: string): void {
        const task = this.tasks.get(taskId);
        const sessionID = task?.sessionID;

        setTimeout(async () => {
            // Delete session from OpenCode
            if (sessionID) {
                try {
                    await this.client.session.delete({
                        path: { id: sessionID },
                    });
                    console.log(`[parallel] 🗑️ CLEANED ${taskId} (session deleted)`);
                    log(`Deleted session ${sessionID}`);
                } catch {
                    console.log(`[parallel] 🗑️ CLEANED ${taskId} (session already gone)`);
                }
            }

            this.tasks.delete(taskId);
            log(`Cleaned up ${taskId} from memory`);
        }, CLEANUP_DELAY_MS);
    }

    // ========================================================================
    // Internal: Notifications
    // ========================================================================

    private queueNotification(task: ParallelTask): void {
        const queue = this.notifications.get(task.parentSessionID) ?? [];
        queue.push(task);
        this.notifications.set(task.parentSessionID, queue);
    }

    private async notifyParentIfAllComplete(parentSessionID: string): Promise<void> {
        const pending = this.pendingByParent.get(parentSessionID);

        // Only notify when ALL tasks for this parent are complete
        if (pending && pending.size > 0) {
            log(`${pending.size} tasks still pending for ${parentSessionID}`);
            return;
        }

        const completedTasks = this.notifications.get(parentSessionID) ?? [];
        if (completedTasks.length === 0) return;

        // Build summary
        const summary = completedTasks.map(t => {
            const status = t.status === "completed" ? "✅" : "❌";
            return `${status} \`${t.id}\`: ${t.description}`;
        }).join("\n");

        const notification = `<system-notification>
**All Parallel Tasks Complete**

${summary}

Use \`get_task_result({ taskId: "task_xxx" })\` to retrieve results.
</system-notification>`;

        try {
            await this.client.session.prompt({
                path: { id: parentSessionID },
                body: {
                    noReply: true,
                    parts: [{ type: "text", text: notification }],
                },
            });
            log(`Notified parent ${parentSessionID}: ${completedTasks.length} tasks`);
        } catch (error) {
            log("Notification error:", error);
        }

        // Clear notifications
        this.notifications.delete(parentSessionID);
    }

    // ========================================================================
    // Internal: Formatting
    // ========================================================================

    formatDuration(start: Date, end?: Date): string {
        const duration = (end ?? new Date()).getTime() - start.getTime();
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}

// Export singleton accessor
export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
};
