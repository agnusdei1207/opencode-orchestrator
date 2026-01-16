/**
 * Parallel Task Tools
 */

import type { ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/async-agent.js";
import { createDelegateTaskTool } from "./delegate-task.js";
import { createGetTaskResultTool } from "./get-task-result.js";
import { createListTasksTool } from "./list-tasks.js";
import { createCancelTaskTool } from "./cancel-task.js";

export { ParallelAgentManager as AsyncAgentManager } from "../../core/async-agent.js";

export function createAsyncAgentTools(manager: ParallelAgentManager, client?: unknown): Record<string, ToolDefinition> {
    return {
        delegate_task: createDelegateTaskTool(manager, client),
        get_task_result: createGetTaskResultTool(manager),
        list_tasks: createListTasksTool(manager),
        cancel_task: createCancelTaskTool(manager),
    };
}
