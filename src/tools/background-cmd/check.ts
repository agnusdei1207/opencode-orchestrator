/**
 * check_background Tool - Check background task status
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { backgroundTaskManager } from "../../core/commands/index.js";
import { BACKGROUND_TASK, STATUS_LABEL, type BackgroundTask } from "../../shared/index.js";

export const checkBackgroundTool: ToolDefinition = tool({
    description: `Check the status and output of a background task.`,
    args: {
        taskId: tool.schema.string().describe("Task ID from run_background"),
        tailLines: tool.schema.number().optional().describe("Limit output to last N lines"),
    },
    async execute(args) {
        const { taskId, tailLines } = args;
        const task = backgroundTaskManager.get(taskId);

        if (!task) return formatTaskNotFound(taskId);

        const duration = backgroundTaskManager.formatDuration(task);
        const statusEmoji = backgroundTaskManager.getStatusEmoji(task.status);

        const output = clipOutput(task.output, tailLines);
        const stderr = clipOutput(task.errorOutput, tailLines);

        let result = formatTaskHeader(task, statusEmoji, duration);

        if (output.trim()) result += `\n\n📤 **stdout:**\n\`\`\`\n${output.trim()}\n\`\`\``;
        if (stderr.trim()) result += `\n\n⚠️ **stderr:**\n\`\`\`\n${stderr.trim()}\n\`\`\``;
        if (task.status === STATUS_LABEL.RUNNING) result += `\n\n⏳ Still running... check again.`;

        return result;
    },
});

/** Commands longer than this are shortened in the "available tasks" list. */
const COMMAND_PREVIEW_LENGTH = 30;

function formatTaskNotFound(taskId: string): string {
    const allTasks = backgroundTaskManager.getAll();
    if (allTasks.length === 0) {
        return `❌ Task \`${taskId}\` not found. No background tasks exist.`;
    }
    const taskList = allTasks.map(t => `- \`${t.id}\`: ${t.command.substring(0, COMMAND_PREVIEW_LENGTH)}...`).join("\n");
    return `❌ Task \`${taskId}\` not found.\n\n**Available:**\n${taskList}`;
}

/** Keeps the last `tailLines` lines (when requested), then caps the length from the end. */
function clipOutput(text: string, tailLines: number | undefined): string {
    let clipped = text;
    if (tailLines && tailLines > 0) {
        clipped = clipped.split("\n").slice(-tailLines).join("\n");
    }
    const { MAX_OUTPUT_LENGTH: maxLen, OUTPUT_TRUNCATION_MARKER: marker } = BACKGROUND_TASK;
    if (clipped.length > maxLen) clipped = marker + clipped.slice(-maxLen);
    return clipped;
}

function formatTaskHeader(task: BackgroundTask, statusEmoji: string, duration: string): string {
    return `${statusEmoji} **Task ${task.id}**${task.label ? ` (${task.label})` : ""}
| Command | \`${task.command}\` |
| Status | ${statusEmoji} **${task.status.toUpperCase()}** |
| Duration | ${duration}${task.status === STATUS_LABEL.RUNNING ? " (ongoing)" : ""} |
${task.exitCode !== null ? `| Exit Code | ${task.exitCode} |` : ""}`;
}
