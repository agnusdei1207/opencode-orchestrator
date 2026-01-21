/**
 * System Transform Handler
 * 
 * Hook: experimental.chat.system.transform
 * 
 * Dynamically injects agent-specific system prompts based on the current
 * session context and orchestrator state.
 */

import type { EventHandlerContext, SystemTransformInput, SystemTransformOutput } from "./interfaces/index.js";
import { readLoopState } from "../core/loop/mission-seal.js";
import { MISSION_SEAL } from "../shared/index.js";

// Re-export interfaces for external use
export type { SystemTransformInput, SystemTransformOutput } from "./interfaces/index.js";

/**
 * Create system transform handler for dynamic prompt injection
 */
export function createSystemTransformHandler(ctx: EventHandlerContext) {
    const { directory, sessions, state } = ctx;

    return async (input: SystemTransformInput, output: SystemTransformOutput): Promise<void> => {
        const { sessionID } = input;

        // Check if this is an orchestrated session
        const orchestratorSession = state.sessions.get(sessionID);
        const isOrchestratedSession = orchestratorSession?.enabled ?? false;
        const session = sessions.get(sessionID);
        const loopState = readLoopState(directory);
        const isActiveLoop = loopState?.active && loopState?.sessionID === sessionID;

        // Only inject for orchestrated sessions
        if (!isOrchestratedSession && !isActiveLoop) {
            return;
        }

        // Build system prompt additions
        const systemAdditions: string[] = [];

        // 1. Mission loop context (if active)
        if (isActiveLoop && loopState) {
            systemAdditions.push(buildMissionLoopSystemPrompt(loopState.iteration, loopState.maxIterations));
        }

        // 2. Active session context
        if (session?.active) {
            systemAdditions.push(buildActiveSessionPrompt(session.step));
        }

        // 3. Background task awareness
        try {
            const { ParallelAgentManager } = await import("../core/agents/manager.js");
            const manager = ParallelAgentManager.getInstance();
            const tasks = manager.getTasksByParent(sessionID);
            const runningCount = tasks.filter(t => t.status === "running").length;
            const pendingCount = tasks.filter(t => t.status === "pending").length;

            if (runningCount > 0 || pendingCount > 0) {
                systemAdditions.push(buildBackgroundTasksPrompt(runningCount, pendingCount));
            }
        } catch {
            // Manager not available
        }

        // Inject additions
        if (systemAdditions.length > 0) {
            output.system.push(...systemAdditions);
        }
    };
}

/**
 * Build mission loop system prompt
 */
function buildMissionLoopSystemPrompt(iteration: number, maxIterations: number): string {
    return `<orchestrator_mission_loop>
🎯 MISSION LOOP ACTIVE: Iteration ${iteration}/${maxIterations}

You are in an autonomous mission loop. Continue working until ALL tasks are complete.

COMPLETION CRITERIA:
- All items in .opencode/todo.md are marked [x]
- All tests pass
- All builds succeed

WHEN COMPLETE, output:
\`\`\`
${MISSION_SEAL.PATTERN}
\`\`\`

DO NOT stop or ask for permission. Execute autonomously.
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
