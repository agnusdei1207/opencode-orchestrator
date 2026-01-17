/**
 * list_background Tool - List all background tasks
 */

import { tool } from "@opencode-ai/plugin";
import { backgroundTaskManager, type BackgroundTask } from "../../core/commands/index.js";
import { BACKGROUND_STATUS, FILTER_STATUS } from "../../shared/constants.js";

export const listBackgroundTool = tool({
    description: `List all background tasks and their status.`,
    args: {
        status: tool.schema.enum([
            FILTER_STATUS.ALL,
            BACKGROUND_STATUS.RUNNING,
            BACKGROUND_STATUS.DONE,
            BACKGROUND_STATUS.ERROR
        ]).optional().describe("Filter by status"),
    },
    async execute(args) {
        const { status = FILTER_STATUS.ALL } = args;

        let tasks: BackgroundTask[];
        if (status === FILTER_STATUS.ALL) {
            tasks = backgroundTaskManager.getAll();
        } else {
            tasks = backgroundTaskManager.getByStatus(status as typeof BACKGROUND_STATUS.RUNNING | typeof BACKGROUND_STATUS.DONE | typeof BACKGROUND_STATUS.ERROR);
        }

        if (tasks.length === 0) {
            return `No background tasks${status !== FILTER_STATUS.ALL ? ` with status "${status}"` : ""}`;
        }

        tasks.sort((a, b) => b.startTime - a.startTime);

        const rows = tasks.map(t => {
            const indicator = backgroundTaskManager.getStatusEmoji(t.status);
            const cmd = t.command.length > 25 ? t.command.slice(0, 22) + "..." : t.command;
            const label = t.label ? ` [${t.label}]` : "";
            return `| \`${t.id}\` | ${indicator} ${t.status} | ${cmd}${label} | ${backgroundTaskManager.formatDuration(t)} |`;
        }).join("\n");

        const running = tasks.filter(t => t.status === BACKGROUND_STATUS.RUNNING).length;
        const done = tasks.filter(t => t.status === BACKGROUND_STATUS.DONE).length;
        const error = tasks.filter(t => t.status === BACKGROUND_STATUS.ERROR || t.status === BACKGROUND_STATUS.TIMEOUT).length;

        return `Background Tasks (${tasks.length})
Running: ${running} | Done: ${done} | Error: ${error}

| ID | Status | Command | Duration |
|----|--------|---------|----------|
${rows}`;
    },
});
