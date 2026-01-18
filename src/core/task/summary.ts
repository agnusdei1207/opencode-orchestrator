/**
 * Task Summary - Generate prompt summaries
 */

import { getHierarchy, getProgress } from "./store.js";
import { getNextTasks } from "./scheduler.js";
import { PARALLEL_TASK } from "../../shared/index.js";

/**
 * Get hierarchy summary for prompts
 */
export function getSummary(sessionId: string): string {
    const hierarchy = getHierarchy(sessionId);
    if (!hierarchy) return "";

    const progress = getProgress(sessionId);
    const nextTasks = getNextTasks(sessionId);

    let summary = `## Task Hierarchy Progress\n\n`;
    summary += `📊 **${progress.completed}/${progress.total}** tasks complete (${progress.percentage}%)\n\n`;

    if (nextTasks.length > 0) {
        summary += `### Next Executable Tasks\n`;
        for (const task of nextTasks.slice(0, 5)) {
            summary += `- [L${task.level}] ${task.description}`;
            if (task.agent) summary += ` → ${task.agent}`;
            if (task.parallelGroup) summary += ` (${PARALLEL_TASK.GROUP_PREFIX} ${task.parallelGroup})`;
            summary += `\n`;
        }
    }

    return summary;
}
