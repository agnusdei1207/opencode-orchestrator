/**
 * Todo Enforcer
 * 
 * Ensures all todos are completed before stopping
 * Automatically continues execution when incomplete todos remain
 */

export interface Todo {
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    priority: "high" | "medium" | "low";
    parentId?: string;
    createdAt: Date;
    completedAt?: Date;
}

export interface TodoStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    percentComplete: number;
}

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
 * Format progress string
 */
export function formatProgress(todos: Todo[]): string {
    const stats = getStats(todos);
    const done = stats.completed + stats.cancelled;
    return `${done}/${stats.total} (${stats.percentComplete}%)`;
}

/**
 * Generate continuation prompt when todos remain
 */
export function generateContinuationPrompt(todos: Todo[]): string {
    const incomplete = todos.filter(t =>
        t.status !== "completed" && t.status !== "cancelled"
    );

    if (incomplete.length === 0) {
        return ""; // Nothing to continue
    }

    const stats = getStats(todos);
    const next = getNextPending(todos);

    let prompt = `<todo_continuation>
📋 **TODO Progress**: ${formatProgress(todos)}

**Incomplete Tasks** (${incomplete.length} remaining):
`;

    for (const todo of incomplete.slice(0, 5)) {
        const status = todo.status === "in_progress" ? "🔄" : "⏳";
        const priority = todo.priority === "high" ? "🔴" : todo.priority === "medium" ? "🟡" : "🟢";
        prompt += `${status} ${priority} [${todo.id}] ${todo.content}\n`;
    }

    if (incomplete.length > 5) {
        prompt += `... and ${incomplete.length - 5} more\n`;
    }

    prompt += `
**Action Required**:
1. Continue working on incomplete todos
2. Mark each task complete when finished
3. Do NOT stop until all todos are completed or cancelled

`;

    if (next) {
        prompt += `**Next Task**: [${next.id}] ${next.content}\n`;
    }

    prompt += `</todo_continuation>`;

    return prompt;
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

/**
 * Generate completion message
 */
export function generateCompletionMessage(todos: Todo[]): string {
    const stats = getStats(todos);

    return `✅ **MISSION COMPLETE**

📊 **Final Status**:
- Total Tasks: ${stats.total}
- Completed: ${stats.completed}
- Cancelled: ${stats.cancelled}
- Success Rate: ${stats.percentComplete}%

All tasks have been processed. Mission accomplished!`;
}
