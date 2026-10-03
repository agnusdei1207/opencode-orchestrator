/**
 * Parallel Agent Manager
 * 
 * Session-based async agent execution with:
 * - Concurrency control per agent type
 * - Batched notifications
 * - Automatic cleanup
 * 
 * This is the main facade that composes the specialized components.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import {
    TASK_CANCELLED_BY_USER,
    TASK_STATUS,
    type LaunchInput,
    type ResumeInput,
    type ParallelTask,
} from "../../shared/index.js";
import { ConcurrencyController } from "./concurrency.js";
import { TaskStore } from "./task-store.js";
import { log } from "./logger.js";

// Import components
import { TaskLauncher, type LaunchResult } from "./manager/task-launcher.js";
import { TaskResumer } from "./manager/task-resumer.js";
import { TaskPoller } from "./manager/task-poller.js";
import { TaskCleaner } from "./manager/task-cleaner.js";
import { EventHandler } from "./manager/event-handler.js";
import { SessionRegistry } from "./session-registry.js";
import { MemoryLevel, MemoryManager } from "../memory/memory-manager.js";
import { CORE_PHILOSOPHY } from "../../agents/prompts/shared/philosophy.js";
import { AgentRegistry } from "./agent-registry.js";
import { TodoManager } from "../todo/todo-manager.js";
import type { ConcurrencyConfig } from "./concurrency.js";
import { finishTaskConcurrency, confirmSessionAbort } from "./manager/task-lifecycle.js";
import { fetchTaskResultText } from "./manager/task-result.js";

// Re-export
export type { ParallelTask };

type OpencodeClient = PluginInput["client"];

type CancellationState = "settled" | "stale" | "proceed";

/**
 * Re-check a task after the (possibly awaited) session abort: another path may
 * have already errored it, or it may have been restarted or finished meanwhile.
 */
function cancellationStateAfterAbort(task: ParallelTask, startedAt: ParallelTask["startedAt"]): CancellationState {
    if (task.startedAt === startedAt && task.status === TASK_STATUS.ERROR) return "settled";
    if (task.startedAt !== startedAt || !isCancellableTaskStatus(task.status)) return "stale";
    return "proceed";
}

export class ParallelAgentManager {
    private static _instance: ParallelAgentManager | undefined;

    private store: TaskStore;
    private client: OpencodeClient;
    private concurrency: ConcurrencyController;
    private sessionRegistry: SessionRegistry;

    // Composed components
    private launcher: TaskLauncher;
    private resumer: TaskResumer;
    private poller: TaskPoller;
    private cleaner: TaskCleaner;
    private eventHandler: EventHandler;

    private constructor(client: OpencodeClient, directory: string, concurrencyConfig?: ConcurrencyConfig) {
        this.client = client;
        this.store = new TaskStore(directory);
        this.concurrency = new ConcurrencyController(concurrencyConfig);
        this.initializeProjectServices(directory);
        this.sessionRegistry = SessionRegistry.getInstance(client, directory);
        this.cleaner = new TaskCleaner(client, this.store, this.concurrency, this.sessionRegistry);
        this.poller = this.createPoller();
        this.launcher = this.createLauncher();
        this.resumer = new TaskResumer(
            client,
            this.store,
            (sessionID) => this.findBySession(sessionID),
            (task, prompt) => {
                this.cleaner.cancelCleanup(task.id);
                this.launcher.startTask(task, prompt);
            },
        );
        this.eventHandler = this.createEventHandler();
    }

    private initializeProjectServices(directory: string): void {
        const memory = MemoryManager.getInstance();
        memory.add(MemoryLevel.SYSTEM, CORE_PHILOSOPHY, 1.0);
        memory.add(MemoryLevel.PROJECT, `Working directory: ${directory}`, 0.9);
        AgentRegistry.getInstance().setDirectory(directory);
        TodoManager.getInstance().setDirectory(directory);
    }

    private createPoller(): TaskPoller {
        return new TaskPoller({
            client: this.client,
            store: this.store,
            concurrency: this.concurrency,
            notifyParentIfAllComplete: parentSessionID => this.cleaner.notifyParentIfAllComplete(parentSessionID),
            scheduleCleanup: taskId => this.cleaner.scheduleCleanup(taskId),
            pruneExpiredTasks: () => this.cleaner.pruneExpiredTasks(),
        });
    }

    private createLauncher(): TaskLauncher {
        return new TaskLauncher({
            client: this.client,
            store: this.store,
            concurrency: this.concurrency,
            sessionRegistry: this.sessionRegistry,
            onTaskError: (taskId, error) => this.handleTaskError(taskId, error),
            startPolling: () => this.poller.start(),
        });
    }

    private createEventHandler(): EventHandler {
        return new EventHandler({
            store: this.store,
            concurrency: this.concurrency,
            findBySession: sessionID => this.findBySession(sessionID),
            notifyParentIfAllComplete: parentSessionID => this.cleaner.notifyParentIfAllComplete(parentSessionID),
            scheduleCleanup: taskId => this.cleaner.scheduleCleanup(taskId),
            validateSessionHasOutput: sessionID => this.poller.validateSessionHasOutput(sessionID),
            forgetSession: sessionID => this.sessionRegistry.forget(sessionID),
        });
    }

    static getInstance(
        client?: OpencodeClient,
        directory?: string,
        concurrencyConfig?: ConcurrencyConfig,
    ): ParallelAgentManager {
        if (!ParallelAgentManager._instance) {
            if (!client || !directory) {
                throw new Error("ParallelAgentManager requires client and directory on first call");
            }
            ParallelAgentManager._instance = new ParallelAgentManager(client, directory, concurrencyConfig);
        }
        return ParallelAgentManager._instance;
    }

    static _resetForTesting(): void {
        ParallelAgentManager._instance = undefined;
    }

    // ========================================================================
    // Public API
    // ========================================================================

    async launch(inputs: LaunchInput | LaunchInput[]): Promise<LaunchResult> {
        this.cleaner.pruneExpiredTasks();
        return this.launcher.launch(inputs);
    }

    async resume(input: ResumeInput): Promise<ParallelTask> {
        const task = this.store.getBySession(input.sessionId);
        if (task && this.cleaner.isCleaning(task.id)) throw new Error("Task session cleanup is already in progress");
        if (task) this.cleaner.cancelCleanup(task.id);
        try {
            return await this.resumer.resume(input);
        } catch (error) {
            if (task && !isCancellableTaskStatus(task.status)) this.cleaner.scheduleCleanup(task.id);
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

    getTaskBySession(sessionID: string): ParallelTask | undefined {
        return this.store.getBySession(sessionID);
    }

    async cancelTasksForParent(parentSessionID: string): Promise<boolean> {
        const active = () => this.getTasksByParent(parentSessionID).filter(task => isCancellableTaskStatus(task.status));
        for (const task of active()) await this.cancelTask(task.id, false);
        if (active().length > 0) return false;
        this.store.clearNotifications(parentSessionID);
        return true;
    }

    async cancelTask(taskId: string, notifyParent = true): Promise<boolean> {
        const task = this.store.get(taskId);
        if (!task || !isCancellableTaskStatus(task.status)) return false;
        const startedAt = task.startedAt;
        if (task.status === TASK_STATUS.RUNNING && !(await confirmSessionAbort(this.client, task.sessionID))) return false;
        const state = cancellationStateAfterAbort(task, startedAt);
        if (state !== "proceed") return state === "settled";

        task.status = TASK_STATUS.ERROR;
        task.error = TASK_CANCELLED_BY_USER;
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            finishTaskConcurrency(task, this.concurrency, false);
        }
        this.store.untrackPending(task.parentSessionID, taskId);

        // A busy session must be aborted before scheduled cleanup releases it
        // (issue #41). Releasing here as well would release it twice.
        this.cleaner.scheduleCleanup(taskId);
        if (notifyParent) {
            this.store.queueNotification(task);
            await this.cleaner.notifyParentIfAllComplete(task.parentSessionID);
        }
        log(`Cancelled ${taskId}`);
        return true;
    }

    async getResult(taskId: string): Promise<string | null> {
        const task = this.store.get(taskId);
        if (!task) return null;
        if (task.status === TASK_STATUS.RUNNING || task.status === TASK_STATUS.PENDING) return null;
        if (task.status === TASK_STATUS.ERROR) return `Error: ${task.error}`;
        if (task.result) return task.result;

        const startedAt = task.startedAt;
        const text = await fetchTaskResultText(this.client, task.sessionID, startedAt);
        if (task.startedAt !== startedAt || this.store.get(taskId) !== task) return null;
        task.result = text;
        return text;
    }

    setConcurrencyLimit(agentType: string, limit: number): void {
        this.concurrency.setLimit(agentType, limit);
    }

    configureConcurrency(config: ConcurrencyConfig): void {
        this.concurrency.configure(config);
    }

    getPendingCount(parentSessionID: string): number {
        return this.store.getPendingCount(parentSessionID);
    }

    getConcurrency(): ConcurrencyController {
        return this.concurrency;
    }

    cleanup(): void {
        this.launcher.shutdown();
        this.poller.stop();
        this.cleaner.shutdown();
        this.store.clear();
        MemoryManager.getInstance().clearTaskMemory();
    }

    /**
     * Shutdown - alias for cleanup, releases all resources
     */
    async shutdown(): Promise<void> {
        try {
            this.cleanup();
            await this.concurrency.shutdown();
        } finally {
            try {
                await this.sessionRegistry.shutdown();
            } finally {
                if (ParallelAgentManager._instance === this) ParallelAgentManager._instance = undefined;
            }
        }
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    handleEvent(event: { type: string; properties?: { sessionID?: string; info?: { id?: string }; error?: unknown } }): void {
        this.eventHandler.handle(event);
        if (event.type === "session.idle" && event.properties?.sessionID) {
            void this.cleaner.notifyParentIfAllComplete(event.properties.sessionID).catch(error => log("Parent notice retry failed", error));
        }
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private findBySession(sessionID: string): ParallelTask | undefined {
        return this.store.getBySession(sessionID);
    }

    private async handleTaskError(taskId: string, error: unknown): Promise<void> {
        const task = this.store.get(taskId);
        if (!task || !isCancellableTaskStatus(task.status)) return;
        const startedAt = task.startedAt;
        if (task.status === TASK_STATUS.RUNNING && !(await confirmSessionAbort(this.client, task.sessionID))) {
            log(`Task ${taskId} failed locally but its session has not confirmed abort`, error);
            return;
        }
        if (task.startedAt !== startedAt || !isCancellableTaskStatus(task.status)) return;

        task.status = TASK_STATUS.ERROR;
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        finishTaskConcurrency(task, this.concurrency, false);
        this.store.untrackPending(task.parentSessionID, taskId);
        this.store.queueNotification(task);
        await this.cleaner.notifyParentIfAllComplete(task.parentSessionID);
        this.cleaner.scheduleCleanup(taskId);
    }
}

export function isCancellableTaskStatus(status: string): boolean {
    return status === TASK_STATUS.RUNNING || status === TASK_STATUS.PENDING;
}
