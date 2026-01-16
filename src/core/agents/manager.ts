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
import { TASK_STATUS, PART_TYPES } from "../../shared/constants.js";
import { ConcurrencyController } from "./concurrency.js";
import { TaskStore } from "./task-store.js";
import { log } from "./logger.js";
import { formatDuration } from "./format.js";
import type { ParallelTask } from "./interfaces/parallel-task.interface.js";
import type { LaunchInput } from "./interfaces/launch-input.interface.js";
import type { ResumeInput } from "./interfaces/resume-input.interface.js";

// Import components
import { TaskLauncher } from "./manager/task-launcher.js";
import { TaskResumer } from "./manager/task-resumer.js";
import { TaskPoller } from "./manager/task-poller.js";
import { TaskCleaner } from "./manager/task-cleaner.js";
import { EventHandler } from "./manager/event-handler.js";

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

    // Composed components
    private launcher: TaskLauncher;
    private resumer: TaskResumer;
    private poller: TaskPoller;
    private cleaner: TaskCleaner;
    private eventHandler: EventHandler;

    private constructor(client: OpencodeClient, directory: string) {
        this.client = client;
        this.directory = directory;

        // Initialize cleaner first (needed by others)
        this.cleaner = new TaskCleaner(client, this.store, this.concurrency);

        // Initialize poller
        this.poller = new TaskPoller(
            client,
            this.store,
            this.concurrency,
            (parentSessionID) => this.cleaner.notifyParentIfAllComplete(parentSessionID),
            (taskId) => this.cleaner.scheduleCleanup(taskId),
            () => this.cleaner.pruneExpiredTasks()
        );

        // Initialize launcher
        this.launcher = new TaskLauncher(
            client,
            directory,
            this.store,
            this.concurrency,
            (taskId, error) => this.handleTaskError(taskId, error),
            () => this.poller.start()
        );

        // Initialize resumer
        this.resumer = new TaskResumer(
            client,
            this.store,
            (sessionID) => this.findBySession(sessionID),
            () => this.poller.start(),
            (parentSessionID) => this.cleaner.notifyParentIfAllComplete(parentSessionID)
        );

        // Initialize event handler
        this.eventHandler = new EventHandler(
            client,
            this.store,
            this.concurrency,
            (sessionID) => this.findBySession(sessionID),
            (parentSessionID) => this.cleaner.notifyParentIfAllComplete(parentSessionID),
            (taskId) => this.cleaner.scheduleCleanup(taskId),
            (sessionID) => this.poller.validateSessionHasOutput(sessionID)
        );
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
        this.cleaner.pruneExpiredTasks();
        return this.launcher.launch(input);
    }

    async resume(input: ResumeInput): Promise<ParallelTask> {
        return this.resumer.resume(input);
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
        if (!task || task.status !== TASK_STATUS.RUNNING) return false;

        task.status = TASK_STATUS.ERROR;
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

        this.cleaner.scheduleCleanup(taskId);
        log(`Cancelled ${taskId}`);
        return true;
    }

    async getResult(taskId: string): Promise<string | null> {
        const task = this.store.get(taskId);
        if (!task) return null;
        if (task.result) return task.result;
        if (task.status === TASK_STATUS.ERROR) return `Error: ${task.error}`;
        if (task.status === TASK_STATUS.RUNNING) return null;

        try {
            const result = await this.client.session.messages({ path: { id: task.sessionID } });
            if (result.error) return `Error: ${result.error}`;

            const messages = (result.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
            const lastMsg = messages.filter(m => m.info?.role === "assistant").reverse()[0];
            if (!lastMsg) return "(No response)";

            const text = lastMsg.parts?.filter(p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING).map(p => p.text ?? "").filter(Boolean).join("\n") ?? "";
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
        this.poller.stop();
        this.store.clear();
    }

    formatDuration = formatDuration;

    // ========================================================================
    // Event Handling
    // ========================================================================

    handleEvent(event: { type: string; properties?: { sessionID?: string; info?: { id?: string } } }): void {
        this.eventHandler.handle(event);
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private findBySession(sessionID: string): ParallelTask | undefined {
        return this.store.getAll().find(t => t.sessionID === sessionID);
    }

    private handleTaskError(taskId: string, error: unknown): void {
        const task = this.store.get(taskId);
        if (!task) return;

        task.status = "error";
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        if (task.concurrencyKey) this.concurrency.release(task.concurrencyKey);
        this.store.untrackPending(task.parentSessionID, taskId);
        this.store.queueNotification(task);
        this.cleaner.notifyParentIfAllComplete(task.parentSessionID);
        this.cleaner.scheduleCleanup(taskId);
    }
}

export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
};
