/**
 * update_todo Tool
 * 
 * Performs incremental updates to .opencode/todo.md
 */

import { tool } from "@opencode-ai/plugin";
import { TodoManager } from "../../core/todo/todo-manager.js";
import { OUTPUT_LABEL, TODO_CONSTANTS } from "../../shared/index.js";

export const createUpdateTodoTool = () => tool({
    description: "Update the status of a task in .opencode/todo.md or add a sub-task. Use this for incremental updates instead of rewriting the whole file.",
    args: {
        action: tool.schema.enum(["update", "add"]).describe("Action to perform"),
        task: tool.schema.string().describe("Text content of the task to update or the parent task to add under"),
        status: tool.schema.enum(Object.values(TODO_CONSTANTS.STATUS)).optional().describe("New status (for 'update' action)"),
        subtask: tool.schema.string().optional().describe("Description of the new sub-task (for 'add' action)"),
    },
    async execute(args) {
        const manager = TodoManager.getInstance();

        if (args.action === "update") {
            if (!args.status) return `${OUTPUT_LABEL.ERROR} 'status' is required for update action.`;
            const success = await manager.updateItem(args.task, args.status as any);
            return success
                ? `${OUTPUT_LABEL.DONE} Updated task status: "${args.task}" -> ${args.status}`
                : `${OUTPUT_LABEL.ERROR} Task not found: "${args.task}"`;
        } else {
            if (!args.subtask) return `${OUTPUT_LABEL.ERROR} 'subtask' is required for add action.`;
            const success = await manager.addSubTask(args.task, args.subtask);
            return success
                ? `${OUTPUT_LABEL.DONE} Added sub-task: "${args.subtask}" under "${args.task}"`
                : `${OUTPUT_LABEL.ERROR} Parent task not found: "${args.task}"`;
        }
    }
});
