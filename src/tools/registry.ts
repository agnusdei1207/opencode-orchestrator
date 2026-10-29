/**
 * Plugin tools. OpenCode's native tools (shell, grep, glob, read, edit, patch,
 * webfetch, subagent) cover everything else, so the plugin adds only what a
 * mission needs that the host does not provide.
 */

import type { ToolDefinition } from "../host/tool.js";
import { TOOL_NAMES } from "../shared/index.js";
import { createUpdateTodoTool } from "./update-todo.js";

export function registerAllTools(): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.UPDATE_TODO]: createUpdateTodoTool(),
    };
}
