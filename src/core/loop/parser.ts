/**
 * Todo Parser - Parse todo data from session
 */

import type { Todo } from "./interfaces.js";
import { STATUS_LABEL } from "../../shared/index.js";

/**
 * Parse todos from session todo list
 */
export function parseTodos(todoData: unknown): Todo[] {
    if (!Array.isArray(todoData)) return [];

    return todoData.map((item: Record<string, unknown>) => ({
        id: String(item.id || ""),
        content: String(item.content || ""),
        status: (item.status as Todo["status"]) || STATUS_LABEL.PENDING,
        priority: (item.priority as Todo["priority"]) || STATUS_LABEL.MEDIUM,
        parentId: item.parentId ? String(item.parentId) : undefined,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        completedAt: item.completedAt ? new Date(item.completedAt as string) : undefined,
    }));
}
