/**
 * list_background Tool - List all background tasks
 */

import { tool } from "@opencode-ai/plugin";
import { backgroundTaskManager, type BackgroundTask } from "../../core/commands/index.js";

export const listBackgroundTool = tool({
    description: `List all background tasks and their status.`,
    args: {
        status: tool.schema.enum(["all", "running", "done", "error"]).optional().describe("Filter by status"),
    },
    async execute(args) {
        const { status = "all" } = args;

        let tasks: BackgroundTask[];
        if (status === "all") {
            tasks = backgroundTaskManager.getAll();
        } else {
            tasks = backgroundTaskManager.getByStatus(status as "running" | "done" | "error");
        }

        if (tasks.length === 0) {
            return `📋 No background tasks${status !== "all" ? ` with status "${status}"` : ""}`;
        }

        tasks.sort((a, b) => b.startTime - a.startTime);

        const rows = tasks.map(t => {
            const emoji = backgroundTaskManager.getStatusEmoji(t.status);
            const cmd = t.command.length > 25 ? t.command.slice(0, 22) + "..." : t.command;
            const label = t.label ? ` [${t.label}]` : "";
            return `| \`${t.id}\` | ${emoji} ${t.status} | ${cmd}${label} | ${backgroundTaskManager.formatDuration(t)} |`;
        }).join("\n");

        const running = tasks.filter(t => t.status === "running").length;
        const done = tasks.filter(t => t.status === "done").length;
        const error = tasks.filter(t => t.status === "error" || t.status === "timeout").length;

        return `📋 **Background Tasks** (${tasks.length})
⏳ Running: ${running} | ✅ Done: ${done} | ❌ Error: ${error}

| ID | Status | Command | Duration |
|----|--------|---------|----------|
${rows}`;
    },
});
