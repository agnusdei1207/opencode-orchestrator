/**
 * kill_background Tool - Kill a running background task
 */

import { tool } from "@opencode-ai/plugin";
import { backgroundTaskManager } from "../../core/commands/index.js";

export const killBackgroundTool = tool({
    description: `Kill a running background task.`,
    args: {
        taskId: tool.schema.string().describe("Task ID to kill"),
    },
    async execute(args) {
        const { taskId } = args;
        const task = backgroundTaskManager.get(taskId);

        if (!task) return `❌ Task \`${taskId}\` not found.`;
        if (task.status !== "running") return `⚠️ Task \`${taskId}\` is not running (${task.status}).`;

        const killed = backgroundTaskManager.kill(taskId);

        if (killed) {
            return `🛑 Task \`${taskId}\` killed.\nCommand: \`${task.command}\`\nDuration: ${backgroundTaskManager.formatDuration(task)}`;
        }

        return `⚠️ Could not kill task \`${taskId}\`.`;
    },
});
