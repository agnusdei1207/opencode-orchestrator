/**
 * list_tasks Tool
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager, type ParallelTask } from "../../core/agents/index.js";
import { getStatusEmoji } from "../../shared/constants.js";

export const createListTasksTool = (manager: ParallelAgentManager) => tool({
    description: `List all background tasks.`,
    args: {
        status: tool.schema.string().optional().describe("Filter: all, running, completed, error"),
    },
    async execute(args) {
        const { status = "all" } = args;
        let tasks: ParallelTask[];

        switch (status) {
            case "running": tasks = manager.getRunningTasks(); break;
            case "completed": tasks = manager.getAllTasks().filter(t => t.status === "completed"); break;
            case "error": tasks = manager.getAllTasks().filter(t => t.status === "error" || t.status === "timeout"); break;
            default: tasks = manager.getAllTasks();
        }

        if (tasks.length === 0) return `📋 No tasks found.`;

        const rows = tasks.map(t => {
            const elapsed = Math.floor((Date.now() - t.startedAt.getTime()) / 1000);
            return `| \`${t.id}\` | ${getStatusEmoji(t.status)} ${t.status} | ${t.agent} | ${elapsed}s |`;
        }).join("\n");

        return `📋 **Tasks**\n\n| ID | Status | Agent | Time |\n|----|--------|-------|------|\n${rows}`;
    },
});
