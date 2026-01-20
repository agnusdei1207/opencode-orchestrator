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

// Import components
import { TaskLauncher } from "./manager/task-launcher.js";
import { TaskResumer } from "./manager/task-resumer.js";
import { TaskPoller } from "./manager/task-poller.js";
import { TaskCleaner } from "./manager/task-cleaner.js";
import { EventHandler } from "./manager/event-handler.js";
import { taskWAL } from "./persistence/task-wal.js";
import { getTaskToastManager } from "../notification/task-toast-manager.js";

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
            () => this.cleaner.pruneExpiredTasks(),
            (task) => this.handleTaskComplete(task)
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
            (sessionID) => this.poller.validateSessionHasOutput(sessionID),
            (task) => this.handleTaskComplete(task)
        );

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
        this.cleaner.pruneExpiredTasks();
        return this.launcher.launch(inputs);
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

        // Log to WAL
        taskWAL.log(WAL_ACTIONS.DELETE, task).catch(() => { });

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
        this.poller.stop();
        this.store.clear();
        import("../session/store.js").then(store => store.clearAll()).catch(() => { });
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

        task.status = TASK_STATUS.ERROR;
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
            this.concurrency.reportResult(task.concurrencyKey, false);
        }
        this.store.untrackPending(task.parentSessionID, taskId);
        this.cleaner.notifyParentIfAllComplete(task.parentSessionID);
        this.cleaner.scheduleCleanup(taskId);

        // Log to WAL
        taskWAL.log(WAL_ACTIONS.UPDATE, task).catch(() => { });
    }

    private async handleTaskComplete(task: ParallelTask): Promise<void> {
        // MSVP: Multi-Stage Verification Pipeline (1차 리뷰)
        // If a WORKER completes, immediately trigger a parallel REVIEWER
        if (task.agent === AGENT_NAMES.WORKER && task.mode !== "race") {
            log(`[MSVP] Triggering 1차 리뷰 (Unit Review) for task ${task.id}`);

            try {
                await this.launch({
                    agent: AGENT_NAMES.REVIEWER,
                    description: `1차 리뷰: ${task.description}`,
                    prompt: `진행된 작업(\`${task.description}\`)에 대해 1차 리뷰(유닛 검증)를 수행하세요.\n` +
                        `주요 점검 사항:\n` +
                        `1. 해당 모듈의 유닛 테스트 코드 작성 여부 및 통과 확인\n` +
                        `2. 코드 품질 및 모듈성 준수 여부\n` +
                        `3. 발견된 결함 즉시 수정 지시 또는 리포트\n\n` +
                        `이 작업은 전체 통합 전 부품 단위의 완결성을 보장하기 위함입니다.`,
                    parentSessionID: task.parentSessionID,
                    depth: task.depth,
                    groupID: task.groupID || task.id, // Group reviews with their origins
                });
            } catch (error) {
                log(`[MSVP] Failed to trigger review for ${task.id}:`, error);
            }
        }
    }

    private async recoverActiveTasks(): Promise<void> {
        const tasks = await taskWAL.readAll();
        if (tasks.size === 0) return;

        log(`Attempting to recover ${tasks.size} tasks from WAL...`);
        let recoveredCount = 0;

        for (const task of tasks.values()) {
            if (task.status === TASK_STATUS.RUNNING) {
                // Verify session still exists on server
                try {
                    const status = await this.client.session.get({ path: { id: task.sessionID } });
                    if (!status.error) {
                        this.store.set(task.id, task);
                        this.store.trackPending(task.parentSessionID, task.id);

                        // Register in Toast Manager
                        const toastManager = getTaskToastManager();
                        if (toastManager) {
                            toastManager.addTask({
                                id: task.id,
                                description: task.description,
                                agent: task.agent,
                                isBackground: true,
                                parentSessionID: task.parentSessionID,
                                sessionID: task.sessionID,
                            });
                        }

                        recoveredCount++;
                    }
                } catch {
                    // Session gone, skip
                }
            } else {
                // Tasks that were already completed/errored at crash
                // can still be added to store if needed, but usually we care about RUNNING ones
            }
        }

        if (recoveredCount > 0) {
            log(`Recovered ${recoveredCount} active tasks.`);
            this.poller.start();
        }
    }
}

export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
};
