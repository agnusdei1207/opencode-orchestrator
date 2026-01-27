import type { PluginInput } from "@opencode-ai/plugin";
import type { ParallelTask } from "./interfaces/parallel-task.interface.js";
import type { LaunchInput } from "./interfaces/launch-input.interface.js";
import { AdaptiveConcurrencyController } from "./adaptive-concurrency.js";
import { SessionPool } from "./session-pool.js";
import { ResourceTracker, ResourceType } from "../resource/resource-tracker.js";
import { log } from "./logger.js";
import { TASK_STATUS, PART_TYPES } from "../../shared/index.js";

type OpencodeClient = PluginInput["client"];

/**
 * Simplified Unified Task Executor
 * Leveraging AdaptiveConcurrencyController and ResourceTracker
 */
export class UnifiedTaskExecutor {
    private client: OpencodeClient;
    private sessionPool: SessionPool;
    private adaptiveConcurrency: AdaptiveConcurrencyController;
    private tasks = new Map<string, ParallelTask>();

    constructor(
        client: OpencodeClient,
        sessionPool: SessionPool,
        adaptive: AdaptiveConcurrencyController
    ) {
        this.client = client;
        this.sessionPool = sessionPool;
        this.adaptiveConcurrency = adaptive;
    }

    async launch(input: LaunchInput): Promise<ParallelTask> {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // 1. Acquire slot (Adaptive)
        await this.adaptiveConcurrency.acquire(input.agent);

        try {
            // 2. Acquire session (Pooled)
            const session = await this.sessionPool.acquireImmediate(
                input.agent,
                input.parentSessionID,
                input.description
            );

            const task: ParallelTask = {
                id: taskId,
                sessionID: session.id,
                parentSessionID: input.parentSessionID,
                description: input.description,
                prompt: input.prompt,
                agent: input.agent,
                status: TASK_STATUS.RUNNING,
                startedAt: new Date(),
                depth: input.depth || 1,
            };

            this.tasks.set(taskId, task);

            // 3. Fire prompt
            await this.client.session.prompt({
                path: { id: session.id },
                body: {
                    parts: [{ type: PART_TYPES.TEXT, text: input.prompt }],
                    agent: input.agent,
                }
            });

            log(`[TaskExecutor] Task launched: ${taskId} (${task.agent}) in session ${session.id.slice(0, 8)}`);
            return task;

        } catch (error) {
            this.adaptiveConcurrency.release(input.agent);
            log(`[TaskExecutor] Launch failed: ${error}`);
            throw error;
        }
    }

    /**
     * Handle events for task completion detection
     */
    async handleEvent(event: any): Promise<void> {
        const sessionID = event.properties?.sessionID || event.properties?.id;
        if (!sessionID) return;

        // Find task by session ID
        const task = Array.from(this.tasks.values()).find(t => t.sessionID === sessionID);
        if (!task) return;

        if (event.type === 'session.idle' && task.status === TASK_STATUS.RUNNING) {
            // Check success (simplified: assume success if no error event received before idle)
            await this.completeTask(task, true);
        }

        if (event.type === 'session.error' && task.status === TASK_STATUS.RUNNING) {
            await this.completeTask(task, false);
        }
    }

    private async completeTask(task: ParallelTask, success: boolean): Promise<void> {
        log(`[TaskExecutor] Task ${task.id} ${success ? 'completed' : 'failed'}`);

        task.status = success ? TASK_STATUS.COMPLETED : TASK_STATUS.ERROR;
        task.completedAt = new Date();

        // Release concurrency and report to adaptive controller
        const duration = Date.now() - task.startedAt.getTime();
        this.adaptiveConcurrency.reportResult(task.agent, success, duration);
        this.adaptiveConcurrency.release(task.agent);

        // Put session back to pool (or invalidate if error)
        if (success) {
            await this.sessionPool.release(task.sessionID);
        } else {
            await this.sessionPool.invalidate(task.sessionID);
        }
    }

    getTask(taskId: string): ParallelTask | undefined {
        return this.tasks.get(taskId);
    }

    getAllTasks(): ParallelTask[] {
        return Array.from(this.tasks.values());
    }

    getTasksByParent(parentID: string): ParallelTask[] {
        return Array.from(this.tasks.values()).filter(t => t.parentSessionID === parentID);
    }
}
