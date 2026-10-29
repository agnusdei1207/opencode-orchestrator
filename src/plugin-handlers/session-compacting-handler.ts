/**
 * Session Compacting Handler
 * 
 * Hook: experimental.session.compacting
 * 
 * Preserves mission state during context compaction by injecting
 * additional context into the compaction prompt.
 */

import { readLoopState } from "../core/loop/mission-loop.js";
import type { MissionLoopState } from "../shared/loop/types.js";
import type { EventHandlerContext } from "./event-handler.js";
import { STATUS_LABEL } from "../shared/index.js";
import { log } from "../core/agents/logger.js";

export interface SessionCompactingInput {
    sessionID: string;
}

export interface SessionCompactingOutput {
    /** Text the host adds to the compaction request. */
    context: string[];
}

/**
 * Create session compacting handler that preserves mission context
 */
export function createSessionCompactingHandler(ctx: EventHandlerContext) {
    const { directory, sessions, agents } = ctx;

    return async (input: SessionCompactingInput, output: SessionCompactingOutput): Promise<void> => {
        const { sessionID } = input;

        // Get active mission loop state
        const loopState = readLoopState(directory);

        // Build context to preserve
        const contextItems: string[] = [];

        // 1. Mission loop context
        if (loopState && loopState.active && loopState.sessionID === sessionID) {
            contextItems.push(buildMissionContext(loopState));
        }

        // 2. Session progress context
        const session = sessions.get(sessionID);
        if (session) {
            contextItems.push(buildSessionContext(session));
        }

        // 3. Active background tasks context
        try {
            const tasks = agents.getTasksByParent(sessionID);
            const activeTasks = tasks.filter(t => t.status === STATUS_LABEL.RUNNING || t.status === STATUS_LABEL.PENDING);

            if (activeTasks.length > 0) {
                contextItems.push(buildBackgroundTasksContext(activeTasks));
            }
        } catch (error) {
            log(`[session-compacting] Failed to inspect background tasks for ${sessionID}: ${error}`);
        }

        // Inject context
        if (contextItems.length > 0) {
            output.context.push(...contextItems);
        }

    };
}

/**
 * Build mission loop context string
 */
function buildMissionContext(loopState: MissionLoopState): string {
    return `<mission_context>
ACTIVE MISSION LOOP:
- Status: Active (Iteration ${loopState.iteration})
- Objective: ${loopState.objective ?? "Continue the active mission"}
- Last Verification: ${loopState.lastVerificationSummary ?? "unknown"}
- Started: ${loopState.startedAt}
- Original Task: ${loopState.prompt.slice(0, 500)}${loopState.prompt.length > 500 ? "..." : ""}

IMPORTANT: Continue this mission after compaction. Check .opencode/todo.md for progress.
Verified TODO leaves use [x]; each verified parent status: completed. Keep unfinished work visible.
</mission_context>`;
}

/**
 * Build session progress context string
 */
function buildSessionContext(session: { step: number; active: boolean; startTime: number }): string {
    const elapsed = Date.now() - session.startTime;
    const minutes = Math.floor(elapsed / 60000);

    return `<session_context>
SESSION PROGRESS:
- Steps executed: ${session.step}
- Duration: ${minutes} minutes
- Status: ${session.active ? "Active" : "Completing"}
</session_context>`;
}

/**
 * Build background tasks context string
 */
function buildBackgroundTasksContext(
    tasks: Array<{ id: string; sessionID?: string; description: string; agent: string; status: string }>
): string {
    const taskList = tasks.map(t => {
        const session = t.sessionID ? ` session=${t.sessionID}` : "";
        return `- ${t.id}${session} agent=${t.agent} status=${t.status} desc=${t.description}`;
    }).join("\n");

    return `<background_tasks_context>
Active background tasks (${tasks.length}):
${taskList}

Wait for completion before finalizing.
</background_tasks_context>`;
}
