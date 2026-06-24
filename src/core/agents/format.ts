/**
 * Format utilities for parallel tasks
 */

import { TASK_STATUS } from "../../shared/index.js";

export function formatDuration(start: Date, end?: Date): string {
    const duration = (end ?? new Date()).getTime() - start.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export function buildAgentTaskCompletionMessage(tasks: Array<{ id: string; agent: string; status: string }>): string {
    const summary = tasks.map(t => {
        const status = t.status === TASK_STATUS.COMPLETED ? "done" : t.status;
        return `- ${t.id} | ${t.agent} | ${status}`;
    }).join("\n");

    return `<system-notification>
Background tasks complete.

${summary}

Next: call get_task_result with the task id(s) you need.
</system-notification>`;
}

export function buildAgentTaskProgressMessage(
    completedTasks: Array<{ id: string }>,
    pendingCount: number,
): string {
    return `[BACKGROUND UPDATE] completed=${completedTasks.length} pending=${pendingCount}\n` +
        `ids=${completedTasks.map(t => t.id).join(",")}`;
}
