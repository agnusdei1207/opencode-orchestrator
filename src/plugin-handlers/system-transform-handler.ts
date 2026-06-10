/**
 * System Transform Handler
 * 
 * Hook: experimental.chat.system.transform
 * 
 * Dynamically injects agent-specific system prompts based on the current
 * session context and orchestrator state.
 */

import type { EventHandlerContext, SystemTransformInput, SystemTransformOutput } from "./interfaces/index.js";
import { readLoopState } from "../core/loop/mission-loop.js";
import { STATUS_LABEL } from "../shared/index.js";
import { ParallelAgentManager } from "../core/agents/manager.js";
import { isMissionActive, ensureSessionInitialized } from "../core/orchestrator/session-manager.js";
import { KnowledgeContextProvider } from "../core/knowledge/context-provider.js";

// Re-export interfaces for external use
export type { SystemTransformInput, SystemTransformOutput } from "./interfaces/index.js";

const knowledgeContextProvider = new KnowledgeContextProvider();

/**
 * Create system transform handler for dynamic prompt injection
 */
export function createSystemTransformHandler(ctx: EventHandlerContext) {
    const { directory, sessions, state } = ctx;

    return async (input: SystemTransformInput, output: SystemTransformOutput): Promise<void> => {
        const { sessionID } = input;

        // sessionID may be undefined in some opencode versions — skip safely
        if (!sessionID) return;

        // Check if this is an orchestrated session
        const loopState = readLoopState(directory);
        const isActiveLoop = isMissionActive(sessionID, directory) || (loopState?.active && loopState?.sessionID === sessionID);
        const session = ensureSessionInitialized(sessions, sessionID, directory);

        // Only inject for orchestrated sessions
        if (!isActiveLoop) {
            return;
        }

        // Build system prompt additions
        const systemAdditions: string[] = [];

        // 1. Mission loop context (if active)
        if (isActiveLoop && loopState) {
            // FUNDAMENTAL: Inject full Commander instructions via system transform
            // This prevents massive prompt injection in user messages.
            const { commander } = await import("../agents/commander.js");
            systemAdditions.push(commander.systemPrompt);
            systemAdditions.push(buildMissionLoopSystemPrompt(loopState));
        }

        // 2. Active session context
        if (session?.active) {
            systemAdditions.push(buildActiveSessionPrompt(session.step));
        }

        // 3. Knowledge graph RAG context for orchestrated sessions
        const knowledgePrompt = buildKnowledgeContextPrompt(
            directory,
            loopState?.prompt,
            state.sessions.get(sessionID)?.currentTask,
        );
        if (knowledgePrompt) {
            systemAdditions.push(knowledgePrompt);
        }

        // 3. Background task awareness
        try {
            const manager = ParallelAgentManager.getInstance();
            const tasks = manager.getTasksByParent(sessionID);
            const runningCount = tasks.filter(t => t.status === STATUS_LABEL.RUNNING).length;
            const pendingCount = tasks.filter(t => t.status === STATUS_LABEL.PENDING).length;

            if (runningCount > 0 || pendingCount > 0) {
                systemAdditions.push(buildBackgroundTasksPrompt(runningCount, pendingCount));
            }
        } catch {
            // Manager not available
        }

        // Inject additions
        if (systemAdditions.length > 0) {
            output.system.unshift(...systemAdditions); // unshift to put core instructions first
        }
    };
}

function buildKnowledgeContextPrompt(
    directory: string,
    missionPrompt?: string,
    currentTask?: string,
): string | null {
    const queryParts = [missionPrompt ?? "", currentTask ?? ""].filter(Boolean);
    return knowledgeContextProvider.buildPrompt(directory, queryParts.join(" ").trim());
}

/**
 * Build mission loop system prompt
 */
function buildMissionLoopSystemPrompt(loopState: {
    iteration: number;
    maxIterations: number;
    objective?: string;
    lastProgress?: string;
    lastVerificationSummary?: string;
}): string {
    return `<orchestrator_mission_loop>
🎯 MISSION LOOP ACTIVE: Iteration ${loopState.iteration}/${loopState.maxIterations}

You are in an autonomous mission loop. Continue working until ALL tasks are verified and 100% complete.

ACTIVE OBJECTIVE:
${loopState.objective ?? "Continue the active mission"}

RUNTIME MEMORY:
- Last progress: ${loopState.lastProgress ?? "unknown"}
- Last verification: ${loopState.lastVerificationSummary ?? "unknown"}

COMPLETION CRITERIA:
- All hierarchical items in .opencode/todo.md are marked [x]
- .opencode/verification-checklist.md is fully checked off [x]
- All tests pass and builds succeed

Do not stop for routine permission or preference checks. Execute autonomously, and ask a concise clarification only when truly blocked and the OpenCode question permission allows it.
</orchestrator_mission_loop>`;
}

/**
 * Build active session prompt
 */
function buildActiveSessionPrompt(stepCount: number): string {
    return `<orchestrator_session>
📊 Orchestrator Session Active
- Steps executed: ${stepCount}
- Mode: Autonomous execution
- Status: Continue working
</orchestrator_session>`;
}

/**
 * Build background tasks prompt
 */
function buildBackgroundTasksPrompt(running: number, pending: number): string {
    return `<orchestrator_background_tasks>
⚡ Background Tasks Status:
- Running: ${running}
- Pending: ${pending}

Use \`get_task_result\` to check completed tasks.
Use \`delegate_task\` with background=true for parallel work.
</orchestrator_background_tasks>`;
}
