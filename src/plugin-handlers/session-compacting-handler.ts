/**
 * Session Compacting Handler
 * 
 * Hook: experimental.session.compacting
 * 
 * Preserves mission state during context compaction by injecting
 * additional context into the compaction prompt.
 */

import { readLoopState, type MissionLoopState } from "../core/loop/mission-seal.js";
import type { EventHandlerContext, SessionCompactingInput, SessionCompactingOutput } from "./interfaces/index.js";

// Re-export interfaces for external use
export type { SessionCompactingInput, SessionCompactingOutput } from "./interfaces/index.js";

/**
 * Create session compacting handler that preserves mission context
 */
export function createSessionCompactingHandler(ctx: EventHandlerContext) {
    const { directory, sessions, state } = ctx;

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

        // 3. Orchestrator state context (check if session is in orchestrator's sessions map)
        const orchestratorSession = state.sessions.get(sessionID);
        if (orchestratorSession?.enabled) {
            contextItems.push(buildOrchestratorContext(orchestratorSession, sessionID));
        }

        // 4. Active background tasks context
        try {
            const { ParallelAgentManager } = await import("../core/agents/manager.js");
            const manager = ParallelAgentManager.getInstance();
            const tasks = manager.getTasksByParent(sessionID);
            const runningTasks = tasks.filter(t => t.status === "running");

            if (runningTasks.length > 0) {
                contextItems.push(buildBackgroundTasksContext(runningTasks));
            }
        } catch {
            // Manager not initialized, skip
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
- Status: Active (Iteration ${loopState.iteration}/${loopState.maxIterations})
- Started: ${loopState.startedAt}
- Original Task: ${loopState.prompt.slice(0, 500)}${loopState.prompt.length > 500 ? "..." : ""}

IMPORTANT: Continue this mission after compaction. Check .opencode/todo.md for progress.
The mission is NOT complete until <mission_seal>SEALED</mission_seal> is output.
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
 * Build orchestrator state context string
 */
function buildOrchestratorContext(
    sessionState: { enabled: boolean; iterations: number; currentTask: string },
    sessionID: string
): string {
    return `<orchestrator_context>
ORCHESTRATOR STATE:
- Session: ${sessionID.slice(0, 12)}...
- Iterations: ${sessionState.iterations}
- Current Task: ${sessionState.currentTask || "Processing"}
- Continue autonomous execution after compaction
</orchestrator_context>`;
}

/**
 * Build background tasks context string
 */
function buildBackgroundTasksContext(tasks: Array<{ id: string; description: string; agent: string; status: string }>): string {
    const taskList = tasks.map(t => `  - [${t.agent}] ${t.description}`).join("\n");

    return `<background_tasks_context>
RUNNING BACKGROUND TASKS (${tasks.length}):
${taskList}

Wait for these tasks to complete before sealing the mission.
</background_tasks_context>`;
}
