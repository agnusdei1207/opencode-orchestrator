/**
 * Task Resumer - Handles resuming existing parallel task sessions
 */

import type { PluginInput } from "@opencode-ai/plugin";
import {
    TASK_STATUS,
    type ParallelTask,
    type ResumeInput,
} from "../../../shared/index.js";
import { TaskStore } from "../task-store.js";
import { log } from "../logger.js";
import { buildRoutedAgentPrompt, type RoutedAgentPrompt } from "./prompt-routing.js";
import { isSessionBusy } from "../../session/activity.js";

type OpencodeClient = PluginInput["client"];

export class TaskResumer {
    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private findBySession: (sessionID: string) => ParallelTask | undefined,
        private startTask: (task: ParallelTask, prompt: RoutedAgentPrompt) => void,
    ) { }

    async resume(input: ResumeInput): Promise<ParallelTask> {
        // Find existing task by session ID
        const existingTask = this.findBySession(input.sessionId);
        if (!existingTask) {
            throw new Error(`Task not found for session: ${input.sessionId}`);
        }

        const routedPrompt = await buildRoutedAgentPrompt(existingTask.agent, input.prompt);
        if (await isSessionBusy(this.client, existingTask.sessionID) || existingTask.status === TASK_STATUS.RUNNING || existingTask.status === TASK_STATUS.PENDING) {
            throw new Error(`Cannot resume session ${existingTask.sessionID}: session is still running`);
        }

        // Reset task state for new execution
        existingTask.status = TASK_STATUS.PENDING;
        existingTask.completedAt = undefined;
        existingTask.error = undefined;
        existingTask.result = undefined;
        existingTask.prompt = input.prompt;
        existingTask.hasStartedOutputting = undefined;
        existingTask.lastMsgCount = undefined;
        existingTask.pollFailureCount = undefined;
        existingTask.progress = undefined;
        existingTask.parentSessionID = input.parentSessionID;
        existingTask.startedAt = new Date();
        existingTask.stablePolls = 0;

        // Track for pending notifications
        this.store.trackPending(input.parentSessionID, existingTask.id);
        log(`Resuming task ${existingTask.id} in session ${existingTask.sessionID}`);
        this.startTask(existingTask, routedPrompt);

        return existingTask;
    }

}
