/**
 * Background Task Tools for OpenCode Orchestrator
 * 
 * These tools allow the AI to run commands in the background and check their results later.
 * This is useful for long-running builds, tests, or other operations.
 */

import { tool } from "@opencode-ai/plugin";
import { backgroundTaskManager, type BackgroundTask } from "../../core/commands/index.js";

// ============================================================================
// run_background Tool
// ============================================================================

export const runBackgroundTool = tool({
    description: `Run a shell command in the background and get a task ID.

<purpose>
Execute long-running commands (builds, tests, etc.) without blocking.
The command runs asynchronously - use check_background to get results.
</purpose>

<examples>
- "npm run build" → Build project in background
- "cargo test" → Run Rust tests
- "sleep 10 && echo done" → Delayed execution
</examples>

<flow>
1. Call run_background with command
2. Get task ID immediately (e.g., job_a1b2c3d4)
3. Continue other work
4. Call check_background with task ID to get results
</flow>`,
    args: {
        command: tool.schema.string().describe("Shell command to execute"),
        cwd: tool.schema.string().optional().describe("Working directory (default: project root)"),
        timeout: tool.schema.number().optional().describe("Timeout in milliseconds (default: 300000 = 5 min)"),
        label: tool.schema.string().optional().describe("Human-readable label for this task"),
    },
    async execute(args) {
        const { command, cwd, timeout, label } = args;

        const task = backgroundTaskManager.run({
            command,
            cwd: cwd || process.cwd(),
            timeout: timeout || 300000,
            label,
        });

        const displayLabel = label ? ` (${label})` : "";

        return `🚀 **Background Task Started**${displayLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Property | Value |
|----------|-------|
| **Task ID** | \`${task.id}\` |
| **Command** | \`${command}\` |
| **Status** | ${backgroundTaskManager.getStatusEmoji(task.status)} ${task.status} |
| **Working Dir** | ${task.cwd} |
| **Timeout** | ${(task.timeout / 1000).toFixed(0)}s |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 **Next Step**: Use \`check_background\` with task ID \`${task.id}\` to get results.`;
    },
});

// ============================================================================
// check_background Tool
// ============================================================================

export const checkBackgroundTool = tool({
    description: `Check the status and output of a background task.

<purpose>
Retrieve the current status and output of a previously started background task.
Use this after run_background to get results.
</purpose>

<output_includes>
- Status: running/done/error/timeout
- Exit code (if completed)
- Duration
- Full output (stdout + stderr)
</output_includes>`,
    args: {
        taskId: tool.schema.string().describe("Task ID from run_background (e.g., job_a1b2c3d4)"),
        tailLines: tool.schema.number().optional().describe("Limit output to last N lines (default: show all)"),
    },
    async execute(args) {
        const { taskId, tailLines } = args;

        const task = backgroundTaskManager.get(taskId);

        if (!task) {
            // List available tasks to help
            const allTasks = backgroundTaskManager.getAll();
            if (allTasks.length === 0) {
                return `❌ Task \`${taskId}\` not found. No background tasks exist.`;
            }

            const taskList = allTasks
                .map(t => `- \`${t.id}\`: ${t.command.substring(0, 30)}...`)
                .join("\n");

            return `❌ Task \`${taskId}\` not found.

**Available tasks:**
${taskList}`;
        }

        const duration = backgroundTaskManager.formatDuration(task);
        const statusEmoji = backgroundTaskManager.getStatusEmoji(task.status);

        // Format output
        let output = task.output;
        let stderr = task.errorOutput;

        if (tailLines && tailLines > 0) {
            const outputLines = output.split("\n");
            const stderrLines = stderr.split("\n");
            output = outputLines.slice(-tailLines).join("\n");
            stderr = stderrLines.slice(-tailLines).join("\n");
        }

        // Truncate very long output
        const maxLen = 10000;
        if (output.length > maxLen) {
            output = `[...truncated ${output.length - maxLen} chars...]\n` + output.substring(output.length - maxLen);
        }
        if (stderr.length > maxLen) {
            stderr = `[...truncated ${stderr.length - maxLen} chars...]\n` + stderr.substring(stderr.length - maxLen);
        }

        const labelDisplay = task.label ? ` (${task.label})` : "";

        let result = `${statusEmoji} **Task ${task.id}**${labelDisplay}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Property | Value |
|----------|-------|
| **Command** | \`${task.command}\` |
| **Status** | ${statusEmoji} **${task.status.toUpperCase()}** |
| **Duration** | ${duration}${task.status === "running" ? " (ongoing)" : ""} |
${task.exitCode !== null ? `| **Exit Code** | ${task.exitCode} |` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        if (output.trim()) {
            result += `

📤 **Output (stdout)**:
\`\`\`
${output.trim()}
\`\`\``;
        }

        if (stderr.trim()) {
            result += `

⚠️ **Errors (stderr)**:
\`\`\`
${stderr.trim()}
\`\`\``;
        }

        if (task.status === "running") {
            result += `

⏳ Task still running... Check again later with:
\`check_background({ taskId: "${task.id}" })\``;
        }

        return result;
    },
});

// ============================================================================
// list_background Tool
// ============================================================================

export const listBackgroundTool = tool({
    description: `List all background tasks and their current status.

<purpose>
Get an overview of all running and completed background tasks.
Useful to check what's in progress before starting new tasks.
</purpose>`,
    args: {
        status: tool.schema.enum(["all", "running", "done", "error"]).optional()
            .describe("Filter by status (default: all)"),
    },
    async execute(args) {
        const { status = "all" } = args;

        let tasks: BackgroundTask[];
        if (status === "all") {
            tasks = backgroundTaskManager.getAll();
        } else {
            tasks = backgroundTaskManager.getByStatus(status as any);
        }

        if (tasks.length === 0) {
            return `📋 **No background tasks** ${status !== "all" ? `with status "${status}"` : ""}

Use \`run_background\` to start a new background task.`;
        }

        // Sort by start time (newest first)
        tasks.sort((a, b) => b.startTime - a.startTime);

        const rows = tasks.map(task => {
            const emoji = backgroundTaskManager.getStatusEmoji(task.status);
            const duration = backgroundTaskManager.formatDuration(task);
            const cmdShort = task.command.length > 25
                ? task.command.substring(0, 22) + "..."
                : task.command;
            const labelPart = task.label ? ` [${task.label}]` : "";

            return `| \`${task.id}\` | ${emoji} ${task.status.padEnd(7)} | ${cmdShort.padEnd(25)}${labelPart} | ${duration.padStart(8)} |`;
        }).join("\n");

        const runningCount = tasks.filter(t => t.status === "running").length;
        const doneCount = tasks.filter(t => t.status === "done").length;
        const errorCount = tasks.filter(t => t.status === "error" || t.status === "timeout").length;

        return `📋 **Background Tasks** (${tasks.length} total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| ⏳ Running: ${runningCount} | ✅ Done: ${doneCount} | ❌ Error/Timeout: ${errorCount} |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Task ID | Status | Command | Duration |
|---------|--------|---------|----------|
${rows}

💡 Use \`check_background({ taskId: "job_xxxxx" })\` to see full output.`;
    },
});

// ============================================================================
// kill_background Tool (Optional but useful)
// ============================================================================

export const killBackgroundTool = tool({
    description: `Kill a running background task.

<purpose>
Stop a background task that is taking too long or no longer needed.
</purpose>`,
    args: {
        taskId: tool.schema.string().describe("Task ID to kill (e.g., job_a1b2c3d4)"),
    },
    async execute(args) {
        const { taskId } = args;

        const task = backgroundTaskManager.get(taskId);
        if (!task) {
            return `❌ Task \`${taskId}\` not found.`;
        }

        if (task.status !== "running") {
            return `⚠️ Task \`${taskId}\` is not running (status: ${task.status}).`;
        }

        const killed = backgroundTaskManager.kill(taskId);

        if (killed) {
            return `🛑 Task \`${taskId}\` has been killed.
Command: \`${task.command}\`
Duration before kill: ${backgroundTaskManager.formatDuration(task)}`;
        }

        return `⚠️ Could not kill task \`${taskId}\`. It may have already finished.`;
    },
});
