/**
 * cancel_task Tool
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/async-agent.js";

export const createCancelTaskTool = (manager: ParallelAgentManager) => tool({
    description: `Cancel a running task.`,
    args: {
        taskId: tool.schema.string().describe("Task ID to cancel"),
    },
    async execute(args) {
        const cancelled = await manager.cancelTask(args.taskId);
        if (cancelled) return `🛑 Cancelled: \`${args.taskId}\``;

        const task = manager.getTask(args.taskId);
        if (task) return `⚠️ Cannot cancel: Task is ${task.status}`;
        return `❌ Not found: \`${args.taskId}\``;
    },
});
