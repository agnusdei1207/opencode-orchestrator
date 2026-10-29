/**
 * Compaction handler: adds the active mission, session progress and running
 * delegated sessions to the host's compaction request so they survive it.
 */

import { readLoopState } from "../core/loop/mission-loop.js";
import type { MissionLoopState } from "../shared/loop/types.js";
import type { EventHandlerContext } from "./event-handler.js";

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
    const { client, directory, sessions, children } = ctx;

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

        // 3. Delegated sessions still at work
        const busyChildren = children.busyChildren(client, sessionID);
        if (busyChildren.length > 0) {
            contextItems.push(buildBackgroundTasksContext(busyChildren));
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
 * Build the delegated-sessions context string
 */
function buildBackgroundTasksContext(sessionIDs: string[]): string {
    return `<background_tasks_context>
Delegated subagent sessions still running (${sessionIDs.length}):
${sessionIDs.map(id => `- ${id}`).join("\n")}

Wait for their completion notices before finalizing.
</background_tasks_context>`;
}
