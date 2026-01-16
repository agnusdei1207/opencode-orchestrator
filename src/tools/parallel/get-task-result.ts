/**
 * get_task_result Tool
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/async-agent.js";

export const createGetTaskResultTool = (manager: ParallelAgentManager) => tool({
    description: `Get result from a completed background task.`,
    args: {
        taskId: tool.schema.string().describe("Task ID"),
    },
    async execute(args) {
        const task = manager.getTask(args.taskId);
        if (!task) return `❌ Task not found: \`${args.taskId}\``;
        if (task.status === "running") return `⏳ Still running...`;

        const result = await manager.getResult(args.taskId);
        const duration = manager.formatDuration(task.startedAt, task.completedAt);

        if (task.status === "error" || task.status === "timeout") {
            return `❌ ${task.status}: ${task.error}`;
        }

        return `✅ Completed (${duration})\n\n${result || "(No output)"}`;
    },
});
