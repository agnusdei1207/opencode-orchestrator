/**
 * Todo Status Checker
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { TODO_STATUS } from "../../../shared/loop/index.js";

interface Todo {
    status: string;
}

export async function hasIncompleteTodos(client: PluginInput["client"], sessionID: string): Promise<boolean> {
    try {
        const response = await client.session.todo({ path: { id: sessionID } });
        const todos = (response.data ?? response) as Todo[];
        if (!todos || todos.length === 0) return false;
        return todos.some((t) => t.status !== TODO_STATUS.COMPLETED && t.status !== TODO_STATUS.CANCELLED);
    } catch {
        return false;
    }
}
