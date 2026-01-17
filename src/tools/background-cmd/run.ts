/**
 * run_background Tool - Start a background command
 */

import { tool } from "@opencode-ai/plugin";
import { backgroundTaskManager } from "../../core/commands/index.js";
import { BACKGROUND_TASK } from "../../shared/index.js";

export const runBackgroundTool = tool({
    description: `Run a shell command in the background and get a task ID.

<purpose>
Execute long-running commands (builds, tests) without blocking.
Use check_background to get results.
</purpose>`,
    args: {
        command: tool.schema.string().describe("Shell command to execute"),
        cwd: tool.schema.string().optional().describe("Working directory"),
        timeout: tool.schema.number().optional().describe(`Timeout in ms (default: ${BACKGROUND_TASK.DEFAULT_TIMEOUT_MS})`),
        label: tool.schema.string().optional().describe("Task label"),
    },
    async execute(args) {
        const { command, cwd, timeout, label } = args;

        const task = backgroundTaskManager.run({
            command,
            cwd: cwd || process.cwd(),
            timeout: timeout || BACKGROUND_TASK.DEFAULT_TIMEOUT_MS,
            label,
        });

        const displayLabel = label ? ` (${label})` : "";

        return `🚀 **Background Task Started**${displayLabel}
| Task ID | \`${task.id}\` |
| Command | \`${command}\` |
| Status | ${backgroundTaskManager.getStatusEmoji(task.status)} ${task.status} |

📌 Use \`check_background({ taskId: "${task.id}" })\` to get results.`;
    },
});
