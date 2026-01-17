/**
 * Todo Formatters - Format output strings
 */

import type { Todo } from "./interfaces.js";
import { getStats, getNextPending } from "./stats.js";
import { MISSION_SEAL, TODO_STATUS } from "../../shared/index.js";

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
 * Enforces parallel dispatch when multiple independent tasks exist
 */
export function generateContinuationPrompt(todos: Todo[]): string {
    const incomplete = todos.filter(t =>
        t.status !== TODO_STATUS.COMPLETED && t.status !== TODO_STATUS.CANCELLED
    );

    if (incomplete.length === 0) {
        return ""; // Nothing to continue
    }

    const next = getNextPending(todos);
    const pendingTasks = incomplete.filter(t => t.status === TODO_STATUS.PENDING);
    const pendingCount = pendingTasks.length;

    let prompt = `<todo_continuation>
📋 **TODO Progress**: ${formatProgress(todos)}

**Incomplete Tasks** (${incomplete.length} remaining):
`;

    for (const todo of incomplete.slice(0, 5)) {
        const status = todo.status === TODO_STATUS.IN_PROGRESS ? "🔄" : "⏳";
        const priority = todo.priority === "high" ? "🔴" : todo.priority === "medium" ? "🟡" : "🟢";
        prompt += `${status} ${priority} [${todo.id}] ${todo.content}\n`;
    }

    if (incomplete.length > 5) {
        prompt += `... and ${incomplete.length - 5} more\n`;
    }

    // PARALLEL DISPATCH ENFORCEMENT - strongly encourage parallel execution
    if (pendingCount >= 2) {
        prompt += `
⚡ **PARALLEL DISPATCH REQUIRED** ⚡
You have ${pendingCount} pending tasks. Launch them ALL IN PARALLEL for maximum efficiency:

\`\`\`
// EXECUTE NOW - Launch all ${pendingCount} tasks simultaneously:
`;
        for (const todo of pendingTasks.slice(0, 6)) {
            prompt += `delegate_task({ agent: "Worker", prompt: "${todo.content}", background: true })\n`;
        }
        prompt += `\`\`\`

⚠️ Do NOT run these sequentially. Use background=true for ALL.
After launching, use list_tasks to monitor progress.

`;
    } else {
        prompt += `
**Action Required**:
1. Continue working on incomplete todos
2. Mark each task complete when finished
3. Do NOT stop until all todos are completed or cancelled

`;
    }

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

    return `🎖️ **MISSION SEALED**

📊 **Final Status**:
- Total Tasks: ${stats.total}
- Completed: ${stats.completed}
- Cancelled: ${stats.cancelled}
- Success Rate: ${stats.percentComplete}%

${MISSION_SEAL.PATTERN}

All tasks have been processed. Mission accomplished!`;
}
