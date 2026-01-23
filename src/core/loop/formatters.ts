/**
 * Todo Formatters - Format output strings
 */

import type { Todo } from "./interfaces.js";
import { getStats, getNextPending } from "./stats.js";
import {
    MISSION_CONTROL,
    TODO_STATUS,
    AGENT_NAMES,
    STATUS_LABEL,
    LOOP_LABELS,
    PROMPT_TAGS,
    TOOL_NAMES,
    PARALLEL_PARAMS
} from "../../shared/index.js";

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

    let prompt = `${PROMPT_TAGS.TODO_CONTINUATION.open}
${LOOP_LABELS.PROGRESS_PREFIX} ${formatProgress(todos)}

**${LOOP_LABELS.INCOMPLETE_TASKS}** (${incomplete.length} remaining):
`;

    for (const todo of incomplete.slice(0, 5)) {
        const statusLabel = todo.status === TODO_STATUS.IN_PROGRESS ? LOOP_LABELS.STATUS.RUNNING : LOOP_LABELS.STATUS.WAITING;
        const priorityLabel = todo.priority === STATUS_LABEL.HIGH ? LOOP_LABELS.PRIORITY.HIGH : todo.priority === STATUS_LABEL.MEDIUM ? LOOP_LABELS.PRIORITY.MEDIUM : LOOP_LABELS.PRIORITY.LOW;
        prompt += `${statusLabel} ${priorityLabel} [${todo.id}] ${todo.content}\n`;
    }

    if (incomplete.length > 5) {
        prompt += `... and ${incomplete.length - 5} more\n`;
    }

    // PARALLEL DISPATCH ENFORCEMENT - strongly encourage parallel execution
    if (pendingCount >= 2) {
        prompt += `
${LOOP_LABELS.PARALLEL_REQUIRED}
You have ${pendingCount} pending tasks. Launch them ALL IN PARALLEL for maximum efficiency:

\`\`\`
${LOOP_LABELS.EXECUTE_NOW.replace("$COUNT", pendingCount.toString())}
`;
        for (const todo of pendingTasks.slice(0, 6)) {
            prompt += `${TOOL_NAMES.DELEGATE_TASK}({ ${PARALLEL_PARAMS.AGENT}: "${AGENT_NAMES.WORKER}", ${PARALLEL_PARAMS.PROMPT}: "${todo.content}", ${PARALLEL_PARAMS.BACKGROUND}: true })\n`;
        }
        prompt += `\`\`\`

${LOOP_LABELS.PARALLEL_NOTICE}
${LOOP_LABELS.MONITOR_PROGRESS}

`;
    } else {
        prompt += `
${LOOP_LABELS.ACTION_REQUIRED}
${LOOP_LABELS.ACTION_CONTINUE}
${LOOP_LABELS.ACTION_MARK_COMPLETE}
${LOOP_LABELS.ACTION_DONT_STOP}

`;
    }

    if (next) {
        prompt += `**${LOOP_LABELS.NEXT_TASK}**: [${next.id}] ${next.content}\n`;
    }

    prompt += PROMPT_TAGS.TODO_CONTINUATION.close;

    return prompt;
}

/**
 * Generate completion message
 */
export function generateCompletionMessage(todos: Todo[]): string {
    const stats = getStats(todos);

    return `${LOOP_LABELS.VERIFIED_COMPLETE}

${LOOP_LABELS.FINAL_STATUS}
- ${LOOP_LABELS.TOTAL_TASKS}: ${stats.total}
- ${LOOP_LABELS.COMPLETED}: ${stats.completed}
- ${LOOP_LABELS.CANCELLED}: ${stats.cancelled}
- ${LOOP_LABELS.SUCCESS_RATE}: ${stats.percentComplete}%

${LOOP_LABELS.MISSION_ACCOMPLISHED}`;
}
