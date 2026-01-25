/**
 * get_task_result Tool
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";
import { STATUS_LABEL, OUTPUT_LABEL, PARALLEL_PARAMS } from "../../shared/index.js";

export const createGetTaskResultTool = (manager: ParallelAgentManager): ToolDefinition => tool({
    description: `Get result from a completed background task.`,
    args: {
        [PARALLEL_PARAMS.TASK_ID]: tool.schema.string().describe("Task ID"),
    },
    async execute(args) {
        const taskId = args[PARALLEL_PARAMS.TASK_ID];
        const task = manager.getTask(taskId);
        if (!task) return `${OUTPUT_LABEL.ERROR} Task not found: \`${taskId}\``;
        if (task.status === STATUS_LABEL.RUNNING) return `${OUTPUT_LABEL.RUNNING} Still working...`;

        const result = await manager.getResult(taskId);
        const duration = manager.formatDuration(task.startedAt, task.completedAt);

        if (task.status === STATUS_LABEL.ERROR || task.status === STATUS_LABEL.TIMEOUT) {
            return `[${task.status.toUpperCase()}] ${task.error}`;
        }

        return `${OUTPUT_LABEL.DONE} Completed in ${duration}\n\n${result || "(No output)"}`;

    },
});
