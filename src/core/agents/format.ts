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

export function buildNotificationMessage(tasks: Array<{ id: string; description: string; status: string }>): string {
    const summary = tasks.map(t => {
        const status = t.status === TASK_STATUS.COMPLETED ? "✅" : "❌";
        return `${status} \`${t.id}\`: ${t.description}`;
    }).join("\n");

    return `<system-notification>
**All Parallel Tasks Complete**

${summary}

Use \`get_task_result({ taskId: "task_xxx" })\` to retrieve results.
</system-notification>`;
}
