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
    TASK_STATUS,
    AGENT_NAMES,
    type LaunchInput,
    type ResumeInput,
    type ParallelTask,
} from "../../shared/index.js";
import { ConcurrencyController } from "./concurrency.js";
import { TaskStore } from "./task-store.js";
import { log } from "./logger.js";
import { formatDuration } from "./format.js";

// Import components
import { TaskLauncher, type LaunchResult } from "./manager/task-launcher.js";
import { TaskResumer } from "./manager/task-resumer.js";
import { TaskPoller } from "./manager/task-poller.js";
import { TaskCleaner } from "./manager/task-cleaner.js";
import { EventHandler } from "./manager/event-handler.js";
import { SessionPool } from "./session-pool.js";
import { progressNotifier } from "../progress/progress-notifier.js";
import { MemoryLevel, MemoryManager } from "../memory/memory-manager.js";
import { CORE_PHILOSOPHY } from "../../agents/prompts/shared/philosophy.js";
import { AgentRegistry } from "./agent-registry.js";
import { TodoManager } from "../todo/todo-manager.js";
import type { ConcurrencyConfig } from "./concurrency.js";
import { finishTaskConcurrency } from "./manager/task-lifecycle.js";
import { fetchTaskResultText } from "./manager/task-result.js";

// Re-export
export type { ParallelTask };
export { formatDuration };

type OpencodeClient = PluginInput["client"];
const UNIT_REVIEW_DESCRIPTION_LIMIT = 240;
const DEFAULT_WORK_STEALING_WORKERS: Record<string, number> = {
    [AGENT_NAMES.PLANNER]: 2,
    [AGENT_NAMES.WORKER]: 8,
    [AGENT_NAMES.REVIEWER]: 4,
    [AGENT_NAMES.COMMANDER]: 1,
};

export function resolveWorkStealingWorkers(config?: ConcurrencyConfig): Record<string, number> {
    return {
        ...DEFAULT_WORK_STEALING_WORKERS,
        ...config?.workStealingWorkers,
    };
}

export class ParallelAgentManager {
    private static _instance: ParallelAgentManager;

    private store = new TaskStore();
    private client: OpencodeClient;
    private concurrency: ConcurrencyController;
    private sessionPool: SessionPool;

    // Composed components
    private launcher: TaskLauncher;
    private resumer: TaskResumer;
    private poller: TaskPoller;
    private cleaner: TaskCleaner;
    private eventHandler: EventHandler;

    private constructor(client: OpencodeClient, directory: string, concurrencyConfig?: ConcurrencyConfig) {
        this.client = client;
        this.concurrency = new ConcurrencyController(concurrencyConfig);

        // Initialize Memory System
        const memory = MemoryManager.getInstance();
        memory.add(MemoryLevel.SYSTEM, CORE_PHILOSOPHY, 1.0);
        memory.add(MemoryLevel.PROJECT, `Working directory: ${directory}`, 0.9);

        // Initialize Agent Registry
        AgentRegistry.getInstance().setDirectory(directory);

        // Initialize Todo Manager
        TodoManager.getInstance().setDirectory(directory);

        // Initialize SessionPool
        this.sessionPool = SessionPool.getInstance(client, directory);

        this.configureWorkStealing(concurrencyConfig);

        // Initialize cleaner first (needed by others)
        this.cleaner = new TaskCleaner(client, this.store, this.concurrency, this.sessionPool);

        // Initialize poller
        this.poller = new TaskPoller(
            client,
            this.store,
            this.concurrency,
            (parentSessionID) => this.cleaner.notifyParentIfAllComplete(parentSessionID),
            (taskId) => this.cleaner.scheduleCleanup(taskId),
            () => this.cleaner.pruneExpiredTasks(),
            (task) => this.handleTaskComplete(task)
        );

        // Initialize launcher
        this.launcher = new TaskLauncher(
            client,
            this.store,
            this.concurrency,
            this.sessionPool,
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
            (sessionID) => this.poller.validateSessionHasOutput(sessionID),
            (sessionID) => this.sessionPool.forget(sessionID),
            (task) => this.handleTaskComplete(task)
        );

        // Initialize ProgressNotifier
        // Task progress reaches the TUI through TaskToastManager; the old
        // TerminalMonitor that used to be started here is gone.
        progressNotifier.setManager(this);
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

    // ========================================================================
    // Public API
    // ========================================================================

    async launch(inputs: LaunchInput | LaunchInput[]): Promise<LaunchResult> {
        this.cleaner.pruneExpiredTasks();
        const result = await this.launcher.launch(inputs);
        progressNotifier.update();
        return result;
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

    getTaskBySession(sessionID: string): ParallelTask | undefined {
        return this.store.getBySession(sessionID);
    }

    async cancelTask(taskId: string): Promise<boolean> {
        const task = this.store.get(taskId);
        if (!task || !isCancellableTaskStatus(task.status)) return false;

        task.status = TASK_STATUS.ERROR;
        task.error = "Cancelled by user";
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            finishTaskConcurrency(task, this.concurrency, false);
        }
        this.store.untrackPending(task.parentSessionID, taskId);

        // Deleting the session used to double as the abort. The pool no longer
        // deletes a busy session (issue #41), so stop the run explicitly and
        // let the scheduled cleanup be the single owner of releasing the
        // session — releasing here too would release it twice, and the second
        // release (10 min later) could compact a session another task has
        // since acquired.
        await this.abortSession(task.sessionID);
        this.cleaner.scheduleCleanup(taskId);



        progressNotifier.update();
        log(`Cancelled ${taskId}`);
        return true;
    }

    async getResult(taskId: string): Promise<string | null> {
        const task = this.store.get(taskId);
        if (!task) return null;
        if (task.result) return task.result;
        if (task.status === TASK_STATUS.ERROR) return `Error: ${task.error}`;
        if (task.status === TASK_STATUS.RUNNING) return null;

        const text = await fetchTaskResultText(this.client, task.sessionID);
        task.result = text;
        return text;
    }

    setConcurrencyLimit(agentType: string, limit: number): void {
        this.concurrency.setLimit(agentType, limit);
    }

    configureConcurrency(config: ConcurrencyConfig): void {
        this.concurrency.configure(config);
        this.configureWorkStealing(config);
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
        this.store.clear();
        MemoryManager.getInstance().clearTaskMemory();
        void import("../session/store.js")
            .then(store => store.clearAll())
            .catch((error) => {
                log("[ParallelAgentManager] Failed to clear session store", error);
            });
    }

    /**
     * Shutdown - alias for cleanup, releases all resources
     */
    async shutdown(): Promise<void> {
        this.cleanup();
        await this.sessionPool.shutdown();
    }

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
        return this.store.getBySession(sessionID);
    }

    private async abortSession(sessionID: string): Promise<void> {
        try {
            await this.client.session.abort({ path: { id: sessionID } });
        } catch (error) {
            log(`[ParallelAgentManager] Failed to abort session ${sessionID}:`, error);
        }
    }

    private configureWorkStealing(config?: ConcurrencyConfig): void {
        for (const [agentName, workerCount] of Object.entries(resolveWorkStealingWorkers(config))) {
            this.concurrency.enableWorkStealing(agentName, workerCount);
        }
    }

    private async handleTaskError(taskId: string, error: unknown): Promise<void> {
        const task = this.store.get(taskId);
        if (!task) return;

        task.status = TASK_STATUS.ERROR;
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        finishTaskConcurrency(task, this.concurrency, false);
        this.store.untrackPending(task.parentSessionID, taskId);
        await this.cleaner.notifyParentIfAllComplete(task.parentSessionID);
        this.cleaner.scheduleCleanup(taskId);

        progressNotifier.update();


    }

    private async handleTaskComplete(task: ParallelTask): Promise<void> {
        // MSVP: Multi-Stage Verification Pipeline (Unit Review)
        // If a WORKER completes, immediately trigger a parallel REVIEWER
        if (task.agent === AGENT_NAMES.WORKER && task.mode !== "race") {
            log(`[MSVP] Triggering Unit Review for task ${task.id}`);

            try {
                await this.launch({
                    agent: AGENT_NAMES.REVIEWER,
                    description: `Unit Review: ${task.description}`,
                    prompt: buildUnitReviewPrompt(task),
                    parentSessionID: task.parentSessionID,
                    depth: task.depth,
                    groupID: task.groupID || task.id, // Group reviews with their origins
                });
            } catch (error) {
                log(`[MSVP] Failed to trigger review for ${task.id}:`, error);
            }
        }
        progressNotifier.update();
    }


}

export function isCancellableTaskStatus(status: string): boolean {
    return status === TASK_STATUS.RUNNING || status === TASK_STATUS.PENDING;
}

export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
    cleanup: () => {
        try {
            ParallelAgentManager.getInstance().cleanup();
        } catch (error) {
            log("[ParallelAgentManager] cleanup skipped or failed", error);
        }
    },
};

export function buildUnitReviewPrompt(task: Pick<ParallelTask, "id" | "description">): string {
    return [
        "[UNIT REVIEW]",
        `task=${task.id}`,
        `desc=${compactWireValue(task.description, UNIT_REVIEW_DESCRIPTION_LIMIT)}`,
        "check=tests,quality,integration",
        "return=findings_only",
    ].join("\n");
}

function compactWireValue(value: string, limit: number): string {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > limit ? `${compact.slice(0, limit - 3)}...` : compact;
}
