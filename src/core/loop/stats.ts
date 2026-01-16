/**
 * Todo Stats - Statistics and queries
 */

import type { Todo, TodoStats } from "./interfaces.js";

/**
 * Get count of incomplete todos
 */
export function getIncompleteCount(todos: Todo[]): number {
    return todos.filter(t =>
        t.status !== "completed" &&
        t.status !== "cancelled"
    ).length;
}

/**
 * Check if there's remaining work
 */
export function hasRemainingWork(todos: Todo[]): boolean {
    return getIncompleteCount(todos) > 0;
}

/**
 * Get next pending todo (highest priority first)
 */
export function getNextPending(todos: Todo[]): Todo | undefined {
    const pending = todos.filter(t =>
        t.status === "pending" || t.status === "in_progress"
    );

    // Sort by priority: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return pending[0];
}

/**
 * Calculate todo statistics
 */
export function getStats(todos: Todo[]): TodoStats {
    const stats = {
        total: todos.length,
        pending: todos.filter(t => t.status === "pending").length,
        inProgress: todos.filter(t => t.status === "in_progress").length,
        completed: todos.filter(t => t.status === "completed").length,
        cancelled: todos.filter(t => t.status === "cancelled").length,
        percentComplete: 0,
    };

    if (stats.total > 0) {
        stats.percentComplete = Math.round(
            ((stats.completed + stats.cancelled) / stats.total) * 100
        );
    }

    return stats;
}

/**
 * Check if mission is complete based on todos
 */
export function isMissionComplete(todos: Todo[]): boolean {
    if (todos.length === 0) {
        return false; // No todos means we don't know completion status
    }

    return !hasRemainingWork(todos);
}
