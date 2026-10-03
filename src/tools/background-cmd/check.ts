/**
 * check_background Tool - Check background task status
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { backgroundTaskManager } from "../../core/commands/index.js";
import { BACKGROUND_TASK, STATUS_LABEL } from "../../shared/index.js";

export const checkBackgroundTool: ToolDefinition = tool({
    description: `Check the status and output of a background task.`,
    args: {
        taskId: tool.schema.string().describe("Task ID from run_background"),
        tailLines: tool.schema.number().optional().describe("Limit output to last N lines"),
    },
    async execute(args) {
        const { taskId, tailLines } = args;
        const task = backgroundTaskManager.get(taskId);

        if (!task) {
            const allTasks = backgroundTaskManager.getAll();
            if (allTasks.length === 0) {
                return `❌ Task \`${taskId}\` not found. No background tasks exist.`;
            }
            const taskList = allTasks.map(t => `- \`${t.id}\`: ${t.command.substring(0, 30)}...`).join("\n");
            return `❌ Task \`${taskId}\` not found.\n\n**Available:**\n${taskList}`;
        }

        const duration = backgroundTaskManager.formatDuration(task);
        const statusEmoji = backgroundTaskManager.getStatusEmoji(task.status);

        let output = task.output;
        let stderr = task.errorOutput;

        if (tailLines && tailLines > 0) {
            output = output.split("\n").slice(-tailLines).join("\n");
            stderr = stderr.split("\n").slice(-tailLines).join("\n");
        }

        const { MAX_OUTPUT_LENGTH: maxLen, OUTPUT_TRUNCATION_MARKER: marker } = BACKGROUND_TASK;
        if (output.length > maxLen) output = marker + output.slice(-maxLen);
        if (stderr.length > maxLen) stderr = marker + stderr.slice(-maxLen);

        let result = `${statusEmoji} **Task ${task.id}**${task.label ? ` (${task.label})` : ""}
| Command | \`${task.command}\` |
| Status | ${statusEmoji} **${task.status.toUpperCase()}** |
| Duration | ${duration}${task.status === STATUS_LABEL.RUNNING ? " (ongoing)" : ""} |
${task.exitCode !== null ? `| Exit Code | ${task.exitCode} |` : ""}`;

        if (output.trim()) result += `\n\n📤 **stdout:**\n\`\`\`\n${output.trim()}\n\`\`\``;
        if (stderr.trim()) result += `\n\n⚠️ **stderr:**\n\`\`\`\n${stderr.trim()}\n\`\`\``;
        if (task.status === STATUS_LABEL.RUNNING) result += `\n\n⏳ Still running... check again.`;

        return result;
    },
});
