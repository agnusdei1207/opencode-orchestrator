/**
 * Task Launcher - Handles launching new parallel tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { ID_PREFIX, TASK_STATUS, PART_TYPES, PARALLEL_TASK, WAL_ACTIONS, TOOL_NAMES } from "../../../shared/index.js";
import { ConcurrencyController } from "../concurrency.js";
import { TaskStore } from "../task-store.js";
import { presets } from "../../../shared/index.js";
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

        // EXECUTION STRATEGY:
        // 1. Create all sessions in parallel (Solves Sequential Task Start bottleneck)
        // 2. Wrap them in ParallelTask objects with PENDING status
        // 3. Register them in the store immediately
        // 4. Background the concurrency acquisition and prompt firing

        const tasks = await Promise.all(taskInputs.map(input =>
            this.prepareTask(input).catch(() => null)
        ));

        const successfulTasks = tasks.filter((t): t is ParallelTask => t !== null);

        // Start background execution for each task
        successfulTasks.forEach(task => {
            this.executeBackground(task).catch(error => {
                this.onTaskError(task.id, error);
            });
        });



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
            throw new Error(`Maximum task depth (${PARALLEL_TASK.MAX_DEPTH}) reached. To prevent infinite recursion, no further sub-tasks can be spawned.`);
        }

        const sessionCreatePromise = this.client.session.create({
            body: {
                parentID: input.parentSessionID,
                title: `${PARALLEL_TASK.SESSION_TITLE_PREFIX}: ${input.description}`
            },
            query: { directory: this.directory },
        });

        // Timeout wrapper for session creation
        const createResult = await Promise.race([
            sessionCreatePromise,
            new Promise<any>((_, reject) =>
                setTimeout(() => reject(new Error("Session creation timed out after 60s")), 60000)
            )
        ]);

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

            // 3. Fire prompt with timeout
            const promptPromise = this.client.session.prompt({
                path: { id: task.sessionID },
                body: {
                    agent: task.agent,
                    tools: {
                        // HPFA: Allow agents to delegate sub-tasks (Fractal Spawning)
                        delegate_task: true,
                        get_task_result: true,
                        list_tasks: true,
                        cancel_task: true,
                        [TOOL_NAMES.SKILL]: true,
                        [TOOL_NAMES.RUN_COMMAND]: true,
                    },
                    parts: [{ type: PART_TYPES.TEXT, text: task.prompt }]
                },
            });

            await Promise.race([
                promptPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Session prompt execution timed out after 600s")), 600000)
                )
            ]);
        } catch (error) {
            // If we acquired but failed to fire, release
            this.concurrency.release(task.agent);
            throw error;
        }
    }
}
