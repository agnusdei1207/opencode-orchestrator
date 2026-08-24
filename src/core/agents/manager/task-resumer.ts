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
import { syntheticTextPart } from "../../session/injection.js";

type OpencodeClient = PluginInput["client"];

export class TaskResumer {
    constructor(
        private client: OpencodeClient,
        private store: TaskStore,
        private findBySession: (sessionID: string) => ParallelTask | undefined,
        private startPolling: () => void,
        private notifyParentIfAllComplete: (parentSessionID: string) => Promise<void>
    ) { }

    async resume(input: ResumeInput): Promise<ParallelTask> {
        // Find existing task by session ID
        const existingTask = this.findBySession(input.sessionId);
        if (!existingTask) {
            throw new Error(`Task not found for session: ${input.sessionId}`);
        }

        const routedPrompt = await buildRoutedAgentPrompt(existingTask.agent, input.prompt);
        if (await isSessionBusy(this.client, existingTask.sessionID)) {
            throw new Error(`Cannot resume session ${existingTask.sessionID}: session is still running`);
        }

        // Reset task state for new execution
        existingTask.status = TASK_STATUS.RUNNING;
        existingTask.completedAt = undefined;
        existingTask.error = undefined;
        existingTask.result = undefined;
        existingTask.parentSessionID = input.parentSessionID;
        existingTask.startedAt = new Date();
        existingTask.stablePolls = 0;

        // Track for pending notifications
        this.store.trackPending(input.parentSessionID, existingTask.id);
        this.startPolling();



        log(`Resuming task ${existingTask.id} in session ${existingTask.sessionID}`);

        this.sendResumePrompt(existingTask, routedPrompt).catch((error) => {
            this.handlePromptError(existingTask, input.parentSessionID, error);
        });

        return existingTask;
    }

    private async sendResumePrompt(task: ParallelTask, routedPrompt: RoutedAgentPrompt): Promise<void> {
        await this.client.session.prompt({
            path: { id: task.sessionID },
            body: {
                agent: routedPrompt.wireAgent,
                tools: routedPrompt.tools,
                parts: [syntheticTextPart(routedPrompt.text)]
            },
        });
    }

    private handlePromptError(task: ParallelTask, parentSessionID: string, error: unknown): void {
        log(`Resume prompt error for ${task.id}:`, error);
        task.status = TASK_STATUS.ERROR;
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();
        this.store.untrackPending(parentSessionID, task.id);
        this.store.queueNotification(task);
        this.notifyParentIfAllComplete(parentSessionID).catch(() => { });
    }
}
