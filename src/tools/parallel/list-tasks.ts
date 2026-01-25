/**
 * list_tasks Tool
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager, type ParallelTask } from "../../core/agents/index.js";
import { STATUS_LABEL, TASK_STATUS, PARALLEL_PARAMS, LOOP_LABELS } from "../../shared/index.js";

export const createListTasksTool = (manager: ParallelAgentManager): ToolDefinition => tool({
    description: `List all background tasks.`,
    args: {
        [PARALLEL_PARAMS.STATUS]: tool.schema.string().optional().describe("Filter: all, running, completed, error"),
    },
    async execute(args) {
        const status = args[PARALLEL_PARAMS.STATUS] || STATUS_LABEL.ALL;
        let tasks: ParallelTask[];

        switch (status) {
            case STATUS_LABEL.RUNNING: tasks = manager.getRunningTasks(); break;
            case STATUS_LABEL.COMPLETED: tasks = manager.getAllTasks().filter(t => t.status === TASK_STATUS.COMPLETED); break;
            case STATUS_LABEL.ERROR: tasks = manager.getAllTasks().filter(t => t.status === TASK_STATUS.ERROR || t.status === TASK_STATUS.TIMEOUT); break;
            default: tasks = manager.getAllTasks();
        }


        if (tasks.length === 0) return `No tasks found.`;

        const rows = tasks.map(t => {
            const elapsed = Math.floor((Date.now() - t.startedAt.getTime()) / 1000);
            return `| \`${t.id}\` | [${t.status.toUpperCase()}] | ${t.agent} | ${elapsed}s |`;
        }).join("\n");

        return `**Tasks List**\n\n| ID | ${LOOP_LABELS.STATUS_TITLE || "Status"} | ${PARALLEL_PARAMS.AGENT.toUpperCase()} | Time |\n|----|--------|-------|------|\n${rows}`;

    },
});
