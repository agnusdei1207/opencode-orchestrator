/**
 * Task Launcher - Handles launching new parallel tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { ID_PREFIX, TASK_STATUS } from "../../../shared/constants.js";
import { ConcurrencyController } from "../concurrency.js";
import { TaskStore } from "../task-store.js";
import { log } from "../logger.js";
import type { ParallelTask } from "../interfaces/parallel-task.interface.js";
import type { LaunchInput } from "../interfaces/launch-input.interface.js";

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

    async launch(input: LaunchInput): Promise<ParallelTask> {
        const concurrencyKey = input.agent;
        await this.concurrency.acquire(concurrencyKey);

        try {
            const createResult = await this.client.session.create({
                body: { parentID: input.parentSessionID, title: `Parallel: ${input.description}` },
                query: { directory: this.directory },
            });

            if (createResult.error) {
                this.concurrency.release(concurrencyKey);
                throw new Error(`Failed to create session: ${createResult.error}`);
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
                status: TASK_STATUS.RUNNING,
                startedAt: new Date(),
                concurrencyKey,
            };

            this.store.set(taskId, task);
            this.store.trackPending(input.parentSessionID, taskId);
            this.startPolling();

            this.client.session.prompt({
                path: { id: sessionID },
                body: { agent: input.agent, parts: [{ type: "text", text: input.prompt }] },
            }).catch((error) => {
                log(`Prompt error for ${taskId}:`, error);
                this.onTaskError(taskId, error);
            });

            log(`Launched ${taskId} in session ${sessionID}`);
            return task;
        } catch (error) {
            this.concurrency.release(concurrencyKey);
            throw error;
        }
    }
}
