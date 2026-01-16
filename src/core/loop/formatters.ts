/**
 * Todo Formatters - Format output strings
 */

import type { Todo } from "./interfaces.js";
import { getStats, getNextPending } from "./stats.js";

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
