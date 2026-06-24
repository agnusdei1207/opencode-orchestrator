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
import type { Hooks } from "@opencode-ai/plugin";
import type { EventHandlerContext } from "./event-handler.js";
import { ParallelAgentManager } from "../core/agents/manager.js";
import { STATUS_LABEL } from "../shared/index.js";
import { handleSessionCompacted } from "../core/loop/mission-loop-handler.js";

type SessionCompactingHook = NonNullable<Hooks["experimental.session.compacting"]>;
export type SessionCompactingInput = Parameters<SessionCompactingHook>[0];
export type SessionCompactingOutput = Parameters<SessionCompactingHook>[1];

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
            const manager = ParallelAgentManager.getInstance();
            const tasks = manager.getTasksByParent(sessionID);
            const runningTasks = tasks.filter(t => t.status === STATUS_LABEL.RUNNING);

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

        // Re-arm compaction guard and cleanup after compaction
        handleSessionCompacted(sessionID);
    };
}

/**
 * Build mission loop context string
 */
function buildMissionContext(loopState: MissionLoopState): string {
    return `<mission_context>
ACTIVE MISSION LOOP:
- Status: Active (Iteration ${loopState.iteration}/${loopState.maxIterations})
- Objective: ${loopState.objective ?? "Continue the active mission"}
- Last Progress: ${loopState.lastProgress ?? "unknown"}
- Last Verification: ${loopState.lastVerificationSummary ?? "unknown"}
- Started: ${loopState.startedAt}
- Original Task: ${loopState.prompt.slice(0, 500)}${loopState.prompt.length > 500 ? "..." : ""}

IMPORTANT: Continue this mission after compaction. Check .opencode/todo.md for progress.
The mission is NOT complete until all hierarchical tasks are verified [x].
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
function buildBackgroundTasksContext(
    tasks: Array<{ id: string; sessionID?: string; description: string; agent: string; status: string }>
): string {
    const taskList = tasks.map(t => {
        const session = t.sessionID ? ` session=${t.sessionID}` : "";
        return `- ${t.id}${session} agent=${t.agent} status=${t.status} desc=${t.description}`;
    }).join("\n");

    return `<background_tasks_context>
Running background tasks (${tasks.length}):
${taskList}

Wait for completion before finalizing.
</background_tasks_context>`;
}
