/**
 * Todo Parser - Parse todo data from session
 */

import type { Todo } from "./interfaces.js";

/**
 * Parse todos from session todo list
 */
export function parseTodos(todoData: unknown): Todo[] {
    if (!Array.isArray(todoData)) return [];

    return todoData.map((item: Record<string, unknown>) => ({
        id: String(item.id || ""),
        content: String(item.content || ""),
        status: (item.status as Todo["status"]) || "pending",
        priority: (item.priority as Todo["priority"]) || "medium",
        parentId: item.parentId ? String(item.parentId) : undefined,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        completedAt: item.completedAt ? new Date(item.completedAt as string) : undefined,
    }));
}
