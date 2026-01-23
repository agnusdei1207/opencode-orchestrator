/**
 * Parallel Task Tools
 */

import type { ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";
import { createDelegateTaskTool } from "./delegate-task.js";
import { createGetTaskResultTool } from "./get-task-result.js";
import { createListTasksTool } from "./list-tasks.js";
import { createCancelTaskTool } from "./cancel-task.js";
import { createListAgentsTool } from "./list-agents.js";
import { createShowMetricsTool } from "./show-metrics.js";
import { createUpdateTodoTool } from "./update-todo.js";
import { TOOL_NAMES } from "../../shared/index.js";

export { ParallelAgentManager as AsyncAgentManager } from "../../core/agents/index.js";

export function createAsyncAgentTools(manager: ParallelAgentManager, client?: unknown): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.DELEGATE_TASK]: createDelegateTaskTool(manager, client),
        [TOOL_NAMES.GET_TASK_RESULT]: createGetTaskResultTool(manager),
        [TOOL_NAMES.LIST_TASKS]: createListTasksTool(manager),
        [TOOL_NAMES.CANCEL_TASK]: createCancelTaskTool(manager),
        [TOOL_NAMES.LIST_AGENTS]: createListAgentsTool(),
        [TOOL_NAMES.SHOW_METRICS]: createShowMetricsTool(),
        [TOOL_NAMES.UPDATE_TODO]: createUpdateTodoTool(),
    };
}

