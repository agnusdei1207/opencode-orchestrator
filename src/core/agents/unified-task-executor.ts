/**
 * Unified Task Executor
 *
 * Consolidates multiple task management components into a single, cohesive executor:
 * - TaskLauncher (launch tasks)
 * - TaskPoller (monitor tasks)
 * - TaskCleaner (cleanup tasks)
 * - TaskResumer (resume tasks)
 * - EventHandler (handle events)
 *
 * This reduces complexity from 5 separate components to 1 unified executor.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { ParallelTask } from "./interfaces/parallel-task.interface.js";
import type { LaunchInput } from "./interfaces/launch-input.interface.js";
import type { ResumeInput } from "./interfaces/resume-input.interface.js";
import { TaskStore } from "./task-store.js";
import { ConcurrencyController } from "./concurrency.js";
import { SessionPool } from "./session-pool.js";
import { taskWAL } from "./persistence/task-wal.js";
import { getTaskToastManager } from "../notification/task-toast-manager.js";
import { log } from "./logger.js";
import {
    PARALLEL_TASK,
    TASK_STATUS,
    MESSAGE_ROLES,
    PART_TYPES,
    WAL_ACTIONS,
    AGENT_NAMES
} from "../../shared/index.js";

type OpencodeClient = PluginInput["client"];

/**
 * Unified Task Executor
 *
 * Combines all task management responsibilities into one cohesive class.
 */
export class UnifiedTaskExecutor {
    private client: OpencodeClient;
    private directory: string;
    private store: TaskStore;
    private concurrency: ConcurrencyController;
    private sessionPool: SessionPool;

    // Polling state
    private pollInterval: NodeJS.Timeout | null = null;
    private isPolling = false;

    // Cleanup state
    private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        client: OpencodeClient,
        directory: string,
        store: TaskStore,
        concurrency: ConcurrencyController,
        sessionPool: SessionPool
    ) {
        this.client = client;
        this.directory = directory;
        this.store = store;
        this.concurrency = concurrency;
        this.sessionPool = sessionPool;
    }

    // ========================================================================
    // LAUNCH: Task Creation and Execution
    // ========================================================================

    /**
     * Launch a new parallel task
     */
    async launch(input: LaunchInput): Promise<ParallelTask> {
        // Set default depth if not provided
        const depth = input.depth ?? 1;

        // Validate depth
        if (depth >= PARALLEL_TASK.MAX_DEPTH) {
            throw new Error(`Max depth ${PARALLEL_TASK.MAX_DEPTH} exceeded (current: ${depth})`);
        }

        // Generate task ID
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

        // Acquire concurrency slot
        const concurrencyKey = input.agent;
        await this.concurrency.acquire(concurrencyKey);

        let sessionID: string | undefined;

        try {
            // Acquire session from pool
            const session = await this.sessionPool.acquire(
                input.agent,
                input.parentSessionID,
                input.description
            );
            sessionID = session.id;

            // Create task
            const task: ParallelTask = {
                id: taskId,
                sessionID,
                parentSessionID: input.parentSessionID,
                description: input.description,
                prompt: input.prompt,
                agent: input.agent,
                status: TASK_STATUS.RUNNING,
                startedAt: new Date(),
                depth: depth,
                concurrencyKey,
                mode: input.mode,
                groupID: input.groupID,
                progress: {
                    toolCalls: 0,
                    lastTool: undefined,
                    lastUpdate: new Date()
                }
            };

            // Store task
            this.store.set(taskId, task);
            this.store.trackPending(input.parentSessionID, taskId);

            // Write to WAL
            await taskWAL.log(WAL_ACTIONS.LAUNCH, task);

            log(`[UnifiedExecutor] Task launched: ${taskId} (agent: ${input.agent}, depth: ${input.depth})`);

            // Notify TUI
            const toastManager = getTaskToastManager();
            if (toastManager) {
                toastManager.addTask({
                    id: taskId,
                    description: input.description,
                    agent: input.agent,
                    isBackground: false,
                    parentSessionID: input.parentSessionID,
                    sessionID,
                    status: TASK_STATUS.RUNNING
                });
            }

            // Send prompt to session
            await this.client.session.prompt({
                path: { id: sessionID },
                body: {
                    agent: input.agent,
                    tools: {},
                    parts: [
                        {
                            type: PART_TYPES.TEXT,
                            text: input.prompt
                        }
                    ]
                }
            });

            // Start polling if not already running
            this.startPolling();

            return task;

        } catch (error) {
            // Release resources on error
            if (sessionID) {
                await this.sessionPool.release(sessionID);
            }
            this.concurrency.release(concurrencyKey);

            log(`[UnifiedExecutor] Launch failed: ${error}`);
            throw error;
        }
    }

    // ========================================================================
    // POLLING: Monitor Task Execution
    // ========================================================================

    /**
     * Start polling for task updates
     */
    private startPolling(): void {
        if (this.isPolling) return;

        this.isPolling = true;
        this.pollInterval = setInterval(() => {
            this.pollTasks().catch(err => {
                log(`[UnifiedExecutor] Poll error: ${err}`);
            });
        }, PARALLEL_TASK.POLL_INTERVAL_MS);

        // Don't keep process alive
        this.pollInterval.unref?.();
    }

    /**
     * Stop polling
     */
    private stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isPolling = false;
    }

    /**
     * Poll all running tasks
     */
    private async pollTasks(): Promise<void> {
        const runningTasks = this.store.getRunning();

        if (runningTasks.length === 0) {
            this.stopPolling();
            return;
        }

        // Poll each task
        for (const task of runningTasks) {
            await this.pollTask(task);
        }

        // Prune expired tasks
        this.pruneExpiredTasks();
    }

    /**
     * Poll a single task
     */
    private async pollTask(task: ParallelTask): Promise<void> {
        try {
            // Get session status
            const result = await this.client.session.get({
                path: { id: task.sessionID }
            });

            if ('error' in result && result.error) {
                const errorMessage = 'Session error';
                await this.handleTaskError(task.id, new Error(errorMessage));
                return;
            }

            const session = result.data;
            if (!session) {
                await this.handleTaskError(task.id, new Error("Session not found"));
                return;
            }

            // Update progress timestamp and get message count
            const messageCount = (session as any).messages?.length || 0;
            if (task.progress) {
                task.progress.lastUpdate = new Date();
            }

            // Check for completion
            // Session is considered complete if it's not busy and has output
            const isBusy = (session as any).status === "busy" || (session as any).busy;
            const hasOutput = messageCount > 1; // More than just the user message

            if (!isBusy && hasOutput) {
                // Check stability
                if (task.lastMsgCount === messageCount) {
                    task.stablePolls = (task.stablePolls || 0) + 1;
                } else {
                    task.stablePolls = 0;
                    task.lastMsgCount = messageCount;
                }

                // Consider complete if stable for required polls
                if (task.stablePolls! >= PARALLEL_TASK.STABLE_POLLS_REQUIRED) {
                    await this.handleTaskComplete(task);
                }
            } else {
                // Reset stability counter if busy
                task.stablePolls = 0;
            }

        } catch (error) {
            log(`[UnifiedExecutor] Poll task ${task.id} error: ${error}`);
        }
    }

    // ========================================================================
    // COMPLETION: Handle Task Completion
    // ========================================================================

    /**
     * Handle task completion
     */
    private async handleTaskComplete(task: ParallelTask): Promise<void> {
        log(`[UnifiedExecutor] Task complete: ${task.id}`);

        // Update task status
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();

        // Write to WAL
        await taskWAL.log(WAL_ACTIONS.UPDATE, task);

        // Release resources
        await this.sessionPool.release(task.sessionID);
        this.concurrency.release(task.concurrencyKey || task.agent);

        // Report success
        this.concurrency.reportResult(task.concurrencyKey || task.agent, true);

        // Untrack pending
        this.store.untrackPending(task.parentSessionID, task.id);

        // Notify TUI
        const toastManager = getTaskToastManager();
        if (toastManager) {
            toastManager.updateTask(task.id, TASK_STATUS.COMPLETED);
        }

        // Schedule cleanup
        this.scheduleCleanup(task.id);

        // Notify parent if all complete
        await this.notifyParentIfAllComplete(task.parentSessionID);
    }

    /**
     * Handle task error
     */
    private async handleTaskError(taskId: string, error: Error): Promise<void> {
        const task = this.store.get(taskId);
        if (!task) return;

        log(`[UnifiedExecutor] Task error: ${taskId} - ${error.message}`);

        // Update task status
        task.status = TASK_STATUS.ERROR;
        task.completedAt = new Date();
        task.error = error.message;

        // Write to WAL
        await taskWAL.log(WAL_ACTIONS.UPDATE, task);

        // Release resources
        await this.sessionPool.release(task.sessionID);
        this.concurrency.release(task.concurrencyKey || task.agent);

        // Report failure
        this.concurrency.reportResult(task.concurrencyKey || task.agent, false);

        // Untrack pending
        this.store.untrackPending(task.parentSessionID, task.id);

        // Notify TUI
        const toastManager = getTaskToastManager();
        if (toastManager) {
            toastManager.updateTask(task.id, TASK_STATUS.ERROR);
        }

        // Schedule cleanup
        this.scheduleCleanup(task.id);

        // Notify parent
        await this.notifyParentIfAllComplete(task.parentSessionID);
    }

    // ========================================================================
    // CLEANUP: Task Cleanup and GC
    // ========================================================================

    /**
     * Schedule cleanup for a task
     */
    private scheduleCleanup(taskId: string): void {
        const timer = setTimeout(() => {
            this.cleanupTask(taskId);
            this.cleanupTimers.delete(taskId);
        }, PARALLEL_TASK.CLEANUP_DELAY_MS);

        this.cleanupTimers.set(taskId, timer);
    }

    /**
     * Cleanup a task
     */
    private async cleanupTask(taskId: string): Promise<void> {
        const task = this.store.get(taskId);
        if (!task) return;

        log(`[UnifiedExecutor] Cleaning up task: ${taskId}`);

        // Remove from store
        this.store.delete(taskId);

        // Write to WAL
        if (task) {
            await taskWAL.log(WAL_ACTIONS.DELETE, task);
        }

        // Remove from TUI
        const toastManager = getTaskToastManager();
        if (toastManager) {
            toastManager.removeTask(taskId);
        }
    }

    /**
     * Prune expired tasks
     */
    private pruneExpiredTasks(): void {
        const now = Date.now();
        const tasks = this.store.getAll();

        for (const task of tasks) {
            const age = now - task.startedAt.getTime();

            if (age > PARALLEL_TASK.TTL_MS) {
                log(`[UnifiedExecutor] Pruning expired task: ${task.id} (age: ${age}ms)`);
                this.handleTaskError(task.id, new Error("Task timeout"));
            }
        }
    }

    // ========================================================================
    // NOTIFICATION: Parent Notification
    // ========================================================================

    /**
     * Notify parent if all tasks complete
     */
    private async notifyParentIfAllComplete(parentSessionID: string): Promise<void> {
        const pendingCount = this.store.getPendingCount(parentSessionID);

        if (pendingCount === 0) {
            log(`[UnifiedExecutor] All tasks complete for parent: ${parentSessionID}`);

            // Get completed tasks
            const tasks = this.store.getByParent(parentSessionID);

            // Send notification message to parent
            const summary = tasks.map(t =>
                `- ${t.status === TASK_STATUS.COMPLETED ? "✅" : "❌"} ${t.description}`
            ).join("\n");

            try {
                // Send notification as a system message (using prompt with empty agent)
                await this.client.session.prompt({
                    path: { id: parentSessionID },
                    body: {
                        agent: "",
                        tools: {},
                        parts: [{
                            type: PART_TYPES.TEXT,
                            text: `All delegated tasks complete:\n\n${summary}`
                        }]
                    }
                });
            } catch (error) {
                log(`[UnifiedExecutor] Failed to notify parent: ${error}`);
            }

            // Clear notifications
            this.store.clearNotifications(parentSessionID);
        }
    }

    // ========================================================================
    // RESUME: Task Recovery
    // ========================================================================

    /**
     * Resume a task from disk
     */
    async resume(input: ResumeInput): Promise<ParallelTask | null> {
        log(`[UnifiedExecutor] Resuming task: ${input.sessionId}`);

        // Read task from WAL
        const tasks = await taskWAL.readAll();
        const task = tasks.get(input.sessionId);

        if (!task) {
            log(`[UnifiedExecutor] No task found to resume: ${input.sessionId}`);
            return null;
        }

        // Restore to store
        this.store.set(task.id, task);
        this.store.trackPending(task.parentSessionID, task.id);

        // Restart polling
        this.startPolling();

        log(`[UnifiedExecutor] Task resumed: ${task.id}`);
        return task;
    }

    /**
     * Recover all active tasks from disk
     */
    async recoverAll(): Promise<number> {
        log("[UnifiedExecutor] Recovering tasks from WAL...");

        const tasks = await taskWAL.readAll();
        let recovered = 0;

        for (const [sessionID, task] of tasks) {
            // Only recover running tasks
            if (task.status === TASK_STATUS.RUNNING || task.status === TASK_STATUS.PENDING) {
                // Check if session still exists
                try {
                    const result = await this.client.session.get({ path: { id: sessionID } });
                    if (result.data) {
                        this.store.set(task.id, task);
                        this.store.trackPending(task.parentSessionID, task.id);
                        recovered++;
                    }
                } catch {
                    // Session doesn't exist, skip
                }
            }
        }

        if (recovered > 0) {
            log(`[UnifiedExecutor] Recovered ${recovered} tasks`);
            this.startPolling();
        }

        return recovered;
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Cancel a task
     */
    async cancel(taskId: string): Promise<boolean> {
        const task = this.store.get(taskId);
        if (!task) return false;

        log(`[UnifiedExecutor] Cancelling task: ${taskId}`);

        // Delete session
        try {
            await this.client.session.delete({ path: { id: task.sessionID } });
        } catch {
            // Ignore errors
        }

        // Mark as cancelled
        await this.handleTaskError(taskId, new Error("Cancelled by user"));
        return true;
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): ParallelTask | undefined {
        return this.store.get(taskId);
    }

    /**
     * Get all tasks
     */
    getAllTasks(): ParallelTask[] {
        return this.store.getAll();
    }

    /**
     * Get tasks by parent
     */
    getTasksByParent(parentSessionID: string): ParallelTask[] {
        return this.store.getByParent(parentSessionID);
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        log("[UnifiedExecutor] Cleaning up...");

        // Stop polling
        this.stopPolling();

        // Clear cleanup timers
        for (const timer of this.cleanupTimers.values()) {
            clearTimeout(timer);
        }
        this.cleanupTimers.clear();

        // Prune old tasks
        this.pruneExpiredTasks();
    }
}
