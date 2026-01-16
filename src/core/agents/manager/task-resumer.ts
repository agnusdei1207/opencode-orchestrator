/**
 * Task Resumer - Handles resuming existing parallel task sessions
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TASK_STATUS, PART_TYPES } from "../../../shared/constants.js";
import { TaskStore } from "../task-store.js";
import { log } from "../logger.js";
import type { ParallelTask } from "../interfaces/parallel-task.interface.js";
import type { ResumeInput } from "../interfaces/resume-input.interface.js";

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

        // Send new prompt to existing session
        this.client.session.prompt({
            path: { id: existingTask.sessionID },
            body: {
                agent: existingTask.agent,
                parts: [{ type: PART_TYPES.TEXT, text: input.prompt }]
            },
        }).catch((error) => {
            log(`Resume prompt error for ${existingTask.id}:`, error);
            existingTask.status = TASK_STATUS.ERROR;
            existingTask.error = error instanceof Error ? error.message : String(error);
            existingTask.completedAt = new Date();
            this.store.untrackPending(input.parentSessionID, existingTask.id);
            this.store.queueNotification(existingTask);
            this.notifyParentIfAllComplete(input.parentSessionID).catch(() => { });
        });

        return existingTask;
    }
}
