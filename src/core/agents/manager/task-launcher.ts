/**
 * Task Launcher - Handles launching new parallel tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { ID_PREFIX, TASK_STATUS, PART_TYPES, PARALLEL_TASK, WAL_ACTIONS } from "../../../shared/index.js";
import { ConcurrencyController } from "../concurrency.js";
import { TaskStore } from "../task-store.js";
import { log } from "../logger.js";
import { presets } from "../../notification/presets.js";
import { getTaskToastManager } from "../../notification/task-toast-manager.js";
import type { ParallelTask } from "../interfaces/parallel-task.interface.js";
import type { LaunchInput } from "../interfaces/launch-input.interface.js";
import { taskWAL } from "../persistence/task-wal.js";

type OpencodeClient = PluginInput["client"];

export class TaskLauncher {
    constructor(
        private client: OpencodeClient,
        private directory: string,
        private store: TaskStore,
        private concurrency: ConcurrencyController,
        private onTaskError: (taskId: string, error: unknown) => void,
        private startPolling: () => void
    ) { }

    /**
     * Unified launch method - handles both single and multiple tasks efficiently.
     * All session creations happen in parallel immediately.
     * Concurrency acquisition and prompt firing happen in the background.
     */
    async launch(inputs: LaunchInput | LaunchInput[]): Promise<ParallelTask | ParallelTask[]> {
        const isArray = Array.isArray(inputs);
        const taskInputs = isArray ? inputs : [inputs];

        if (taskInputs.length === 0) return isArray ? [] : (null as any);

        log(`[task-launcher.ts] Batch launching ${taskInputs.length} task(s)`);
        const startTime = Date.now();

        // EXECUTION STRATEGY:
        // 1. Create all sessions in parallel (Solves Sequential Task Start bottleneck)
        // 2. Wrap them in ParallelTask objects with PENDING status
        // 3. Register them in the store immediately
        // 4. Background the concurrency acquisition and prompt firing

        const tasks = await Promise.all(taskInputs.map(input =>
            this.prepareTask(input).catch(error => {
                log(`[task-launcher.ts] Failed to prepare task ${input.description}:`, error);
                return null;
            })
        ));

        const successfulTasks = tasks.filter((t): t is ParallelTask => t !== null);

        // Start background execution for each task
        successfulTasks.forEach(task => {
            this.executeBackground(task).catch(error => {
                log(`[task-launcher.ts] Background execution failed for ${task.id}:`, error);
                this.onTaskError(task.id, error);
            });
        });

        const elapsed = Date.now() - startTime;
        log(`[task-launcher.ts] Batch launch prepared: ${successfulTasks.length} tasks in ${elapsed}ms`);

        // Start polling if we have running/pending tasks
        if (successfulTasks.length > 0) {
            this.startPolling();
        }

        return isArray ? successfulTasks : (successfulTasks[0] || null);
    }

    /**
     * Prepare task: Create session and registration without blocking on concurrency
     */
    private async prepareTask(input: LaunchInput): Promise<ParallelTask> {
        // HPFA: Depth Guard
        const currentDepth = input.depth ?? 0;
        if (currentDepth >= PARALLEL_TASK.MAX_DEPTH) {
            log(`[task-launcher.ts] Task depth limit reached (${currentDepth}/${PARALLEL_TASK.MAX_DEPTH}). Generation blocked.`);
            throw new Error(`Maximum task depth (${PARALLEL_TASK.MAX_DEPTH}) reached. To prevent infinite recursion, no further sub-tasks can be spawned.`);
        }

        const createResult = await this.client.session.create({
            body: {
                parentID: input.parentSessionID,
                title: `${PARALLEL_TASK.SESSION_TITLE_PREFIX}: ${input.description}`
            },
            query: { directory: this.directory },
        });

        if (createResult.error || !createResult.data?.id) {
            throw new Error(`Session creation failed: ${createResult.error || "No ID"}`);
        }

        const sessionID = createResult.data.id;
        const taskId = `${ID_PREFIX.TASK}${crypto.randomUUID().slice(0, 8)}`;

        const task: ParallelTask = {
            id: taskId,
            sessionID,
            parentSessionID: input.parentSessionID,
            description: input.description,
            prompt: input.prompt,
            agent: input.agent,
            status: TASK_STATUS.PENDING, // Start as PENDING
            startedAt: new Date(),
            concurrencyKey: input.agent,
            depth: (input.depth ?? 0) + 1,
            mode: input.mode || "normal",
            groupID: input.groupID,
        };

        // State tracking
        this.store.set(taskId, task);
        this.store.trackPending(input.parentSessionID, taskId);
        taskWAL.log(WAL_ACTIONS.LAUNCH, task).catch(() => { });

        // Registry in Toast & UI
        const toastManager = getTaskToastManager();
        if (toastManager) {
            toastManager.addTask({
                id: taskId,
                description: input.description,
                agent: input.agent,
                isBackground: true,
                parentSessionID: input.parentSessionID,
                sessionID,
            });
        }
        presets.sessionCreated(sessionID, input.agent);

        return task;
    }

    /**
     * Background execution: Acquire slot and fire prompt
     */
    private async executeBackground(task: ParallelTask): Promise<void> {
        try {
            // 1. Wait for concurrency slot
            await this.concurrency.acquire(task.agent);

            // 2. Update status to RUNNING
            task.status = TASK_STATUS.RUNNING;
            task.startedAt = new Date(); // Reset start time to when it actually started running
            this.store.set(task.id, task);
            taskWAL.log(WAL_ACTIONS.LAUNCH, task).catch(() => { });

            // 3. Fire prompt
            await this.client.session.prompt({
                path: { id: task.sessionID },
                body: {
                    agent: task.agent,
                    tools: {
                        // HPFA: Allow agents to delegate sub-tasks (Fractal Spawning)
                        delegate_task: true,
                        get_task_result: true,
                        list_tasks: true,
                        cancel_task: true,
                    },
                    parts: [{ type: PART_TYPES.TEXT, text: task.prompt }]
                },
            });

            log(`[task-launcher.ts] Task ${task.id} (${task.agent}) started running`);
        } catch (error) {
            // If we acquired but failed to fire, release
            this.concurrency.release(task.agent);
            throw error;
        }
    }
}
