/**
 * get_task_result Tool
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";
import { formatDuration } from "../../core/agents/format.js";
import { STATUS_LABEL, OUTPUT_LABEL, PARALLEL_PARAMS, type ParallelTask } from "../../shared/index.js";

export const createGetTaskResultTool = (manager: ParallelAgentManager): ToolDefinition => tool({
    description: `Get result from a completed background task.`,
    args: {
        [PARALLEL_PARAMS.TASK_ID]: tool.schema.string().describe("Task ID"),
    },
    async execute(args) {
        const taskId = args[PARALLEL_PARAMS.TASK_ID];
        const task = manager.getTask(taskId);
        if (!task) return `${OUTPUT_LABEL.ERROR} Task not found: \`${taskId}\``;
        const notReady = notCompletedReply(task);
        if (notReady !== null) return notReady;
        return readCompletedResult(manager, taskId, task);
    },
});

/** Reply for a task that has no completed result to read, or null when it has one. */
function notCompletedReply(task: ParallelTask): string | null {
    if (task.status === STATUS_LABEL.RUNNING) return `${OUTPUT_LABEL.RUNNING} Still working...`;
    if (task.status !== STATUS_LABEL.COMPLETED) {
        return `[${task.status.toUpperCase()}] ${task.error || "No completed result available."}`;
    }
    return null;
}

async function readCompletedResult(manager: ParallelAgentManager, taskId: string, task: ParallelTask): Promise<string> {
    const startedAt = task.startedAt;
    try {
        const result = await manager.getResult(taskId);
        if (manager.getTask(taskId) !== task || task.startedAt !== startedAt || task.status !== STATUS_LABEL.COMPLETED) {
            return `${OUTPUT_LABEL.ERROR} Task changed during result retrieval; check its current status.`;
        }
        const duration = formatDuration(task.startedAt, task.completedAt);
        return `${OUTPUT_LABEL.DONE} Completed in ${duration}\n\n${result || "(No output)"}`;
    } catch (error) {
        return `${OUTPUT_LABEL.ERROR} Result unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
}
