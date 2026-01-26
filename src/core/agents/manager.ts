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
import { TASK_STATUS, PART_TYPES, MESSAGE_ROLES, WAL_ACTIONS, AGENT_NAMES } from "../../shared/index.js";
import { ConcurrencyController } from "./concurrency.js";
import { TaskStore } from "./task-store.js";
import { log } from "./logger.js";
import { formatDuration } from "./format.js";
import type { ParallelTask } from "./interfaces/parallel-task.interface.js";
import type { LaunchInput } from "./interfaces/launch-input.interface.js";
import type { ResumeInput } from "./interfaces/resume-input.interface.js";

import { startHealthCheck, stopHealthCheck } from "../session/session-health.js";

// Import unified executor (replaces 5 separate components)
import { UnifiedTaskExecutor } from "./unified-task-executor.js";
import { SessionPool } from "./session-pool.js";
import { taskWAL } from "./persistence/task-wal.js";
import { getTaskToastManager } from "../notification/task-toast-manager.js";
import { progressNotifier } from "../progress/progress-notifier.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { MemoryLevel } from "../memory/interfaces.js";
import { CORE_PHILOSOPHY } from "../../agents/prompts/01_philosophy/core.js";
import { AgentRegistry } from "./agent-registry.js";
import { TodoManager } from "../todo/todo-manager.js";

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
    private sessionPool: SessionPool;

    // Unified executor (replaces 5 separate components)
    private executor: UnifiedTaskExecutor;

    private constructor(client: OpencodeClient, directory: string) {
        this.client = client;
        this.directory = directory;

        // Initialize Session Health Monitor
        startHealthCheck(client);

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

        // Initialize unified executor (replaces 5 separate components)
        this.executor = new UnifiedTaskExecutor(
            client,
            directory,
            this.store,
            this.concurrency,
            this.sessionPool
        );

        // Initialize ProgressNotifier
        progressNotifier.setManager(this);

        // Bootstrap recovery
        this.recoverActiveTasks().catch(err => {
            log("Recovery error:", err);
        });
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

    async launch(inputs: LaunchInput | LaunchInput[]): Promise<ParallelTask | ParallelTask[]> {
        // Handle single or multiple inputs
        if (Array.isArray(inputs)) {
            const results = await Promise.all(inputs.map(input => this.executor.launch(input)));
            progressNotifier.update();
            return results;
        } else {
            const result = await this.executor.launch(inputs);
            progressNotifier.update();
            return result;
        }
    }

    async resume(input: ResumeInput): Promise<ParallelTask> {
        const task = await this.executor.resume(input);
        if (!task) {
            throw new Error(`Task not found: ${input.sessionId}`);
        }
        return task;
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
        const result = await this.executor.cancel(taskId);
        if (result) {
            progressNotifier.update();
        }
        return result;
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
            const lastMsg = messages.filter(m => m.info?.role === MESSAGE_ROLES.ASSISTANT).reverse()[0];
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

    getConcurrency(): ConcurrencyController {
        return this.concurrency;
    }

    cleanup(): void {
        this.executor.cleanup();
        stopHealthCheck();
        this.store.clear();
        MemoryManager.getInstance().clearTaskMemory();
        import("../session/store.js").then(store => store.clearAll()).catch(() => { });
    }

    formatDuration = formatDuration;

    // ========================================================================
    // Event Handling
    // ========================================================================

    handleEvent(event: { type: string; properties?: { sessionID?: string; info?: { id?: string } } }): void {
        // Event handling is now integrated into UnifiedTaskExecutor
        // Events are processed directly during task lifecycle methods
        log("[ParallelAgentManager] Event received:", event.type);
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private findBySession(sessionID: string): ParallelTask | undefined {
        return this.store.getAll().find(t => t.sessionID === sessionID);
    }

    private handleTaskError(taskId: string, error: unknown): void {
        // Error handling is now integrated into UnifiedTaskExecutor
        // This method is kept for backwards compatibility but delegates to executor
        log(`[ParallelAgentManager] Delegating error handling to executor for task ${taskId}`);
    }

    private async handleTaskComplete(task: ParallelTask): Promise<void> {
        // Task completion handling is now integrated into UnifiedTaskExecutor
        // MSVP logic would need to be implemented in the executor if needed
        log(`[ParallelAgentManager] Task ${task.id} completed`);
        progressNotifier.update();
    }

    private async recoverActiveTasks(): Promise<void> {
        // Recovery is now handled by UnifiedTaskExecutor
        const recoveredCount = await this.executor.recoverAll();
        if (recoveredCount > 0) {
            log(`Recovered ${recoveredCount} active tasks via UnifiedTaskExecutor.`);
            progressNotifier.update();
        }
    }
}

export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
    cleanup: () => {
        try {
            ParallelAgentManager.getInstance().cleanup();
        } catch {
            // Not initialized, ignore
        }
    },
};
