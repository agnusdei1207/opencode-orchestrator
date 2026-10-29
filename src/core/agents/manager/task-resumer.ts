/**
 * Task Resumer - Handles resuming existing parallel task sessions
 */

import type { HostClient } from "../../../host/client.js";
import {
    TASK_STATUS,
    type ParallelTask,
    type ResumeInput,
} from "../../../shared/index.js";
import { TaskStore } from "../task-store.js";
import { log } from "../logger.js";
import type { RoutedAgentPrompt } from "./prompt-routing.js";
import { isSessionBusy } from "../../session/activity.js";

export class TaskResumer {
    constructor(
        private client: HostClient,
        private store: TaskStore,
        private findBySession: (sessionID: string) => ParallelTask | undefined,
        private startTask: (task: ParallelTask, prompt: RoutedAgentPrompt) => void,
        private routePrompt: (agent: string, prompt: string) => Promise<RoutedAgentPrompt>,
    ) { }

    async resume(input: ResumeInput): Promise<ParallelTask> {
        const existingTask = this.findBySession(input.sessionId);
        if (!existingTask) {
            throw new Error(`Task not found for session: ${input.sessionId}`);
        }

        const startedAt = existingTask.startedAt;
        const routedPrompt = await this.routePrompt(existingTask.agent, input.prompt);
        if (await isSessionBusy(this.client, existingTask.sessionID) || existingTask.status === TASK_STATUS.RUNNING || existingTask.status === TASK_STATUS.PENDING) {
            throw new Error(`Cannot resume session ${existingTask.sessionID}: session is still running`);
        }
        if (this.findBySession(input.sessionId) !== existingTask || existingTask.startedAt !== startedAt) {
            throw new Error(`Cannot resume session ${input.sessionId}: task changed while checking activity`);
        }

        existingTask.status = TASK_STATUS.PENDING;
        existingTask.completedAt = undefined;
        existingTask.error = undefined;
        existingTask.result = undefined;
        existingTask.prompt = input.prompt;
        existingTask.parentSessionID = input.parentSessionID;
        existingTask.startedAt = new Date();

        this.store.trackPending(input.parentSessionID, existingTask.id);
        log(`Resuming task ${existingTask.id} in session ${existingTask.sessionID}`);
        this.startTask(existingTask, routedPrompt);

        return existingTask;
    }

}
