import type { PluginHandlerContext } from "./context.js";
import { readLoopState } from "../core/loop/mission-loop.js";
import { PATHS, STATUS_LABEL } from "../shared/index.js";
import { ParallelAgentManager } from "../core/agents/manager.js";
import { ensureSessionInitialized } from "../core/orchestrator/session-manager.js";
import { readMissionScratchpadSnapshot } from "../core/knowledge/mission-memory.js";
import { log } from "../core/agents/logger.js";

/** Dynamic state belongs after conversation history so it cannot invalidate its prefix. */
export function createMissionContextBuilder(ctx: Pick<PluginHandlerContext, "directory" | "sessions">) {
    const { directory, sessions } = ctx;

    return (sessionID: string | undefined): string | undefined => {
        if (!sessionID) return undefined;
        const loopState = readLoopState(directory);
        if (loopState?.active !== true || loopState.sessionID !== sessionID) {
            return undefined;
        }
        const session = ensureSessionInitialized(sessions, sessionID, directory);

        const additions = missionLoopAdditions(loopState, directory);

        if (session?.active) {
            additions.push(buildActiveSessionPrompt(session.step));
        }

        const backgroundPrompt = buildBackgroundTasksAddition(sessionID);
        if (backgroundPrompt) {
            additions.push(backgroundPrompt);
        }

        return additions.join("\n\n");
    };
}

function missionLoopAdditions(
    loopState: Parameters<typeof buildMissionLoopPrompt>[0],
    directory: string,
): string[] {
    const additions = [buildMissionLoopPrompt(loopState)];
    const scratchpadPrompt = buildMissionScratchpadPrompt(directory);
    if (scratchpadPrompt) {
        additions.push(scratchpadPrompt);
    }
    return additions;
}

function buildBackgroundTasksAddition(sessionID: string): string | null {
    try {
        const manager = ParallelAgentManager.getInstance();
        const tasks = manager.getTasksByParent(sessionID);
        const runningCount = tasks.filter(t => t.status === STATUS_LABEL.RUNNING).length;
        const pendingCount = tasks.filter(t => t.status === STATUS_LABEL.PENDING).length;

        if (runningCount > 0 || pendingCount > 0) {
            return buildBackgroundTasksPrompt(runningCount, pendingCount);
        }
    } catch (error) {
        log(`[mission-context] Failed to inspect background tasks for ${sessionID}: ${error}`);
    }
    return null;
}

function buildMissionScratchpadPrompt(directory: string): string | null {
    try {
        const snapshot = readMissionScratchpadSnapshot(directory);
        if (!snapshot) return null;

        return `<mission_scratchpad path="${PATHS.DOCS}/brain/scratchpad.md">
${snapshot}
</mission_scratchpad>`;
    } catch (error) {
        log(`[mission-context] Failed to read optional mission scratchpad: ${error}`);
        return null;
    }
}

function buildMissionLoopPrompt(loopState: {
    iteration: number;
    maxIterations: number;
    objective?: string;
    lastProgress?: string;
    lastVerificationSummary?: string;
}): string {
    return `<orchestrator_mission_loop>
MISSION LOOP ACTIVE: Iteration ${loopState.iteration}/${loopState.maxIterations}
Objective: ${loopState.objective ?? "Continue the active mission"}
- Last progress: ${loopState.lastProgress ?? "unknown"}
- Last verification: ${loopState.lastVerificationSummary ?? "unknown"}
Done when every verified TODO leaf is [x] and each verified parent status: completed, and all tests and builds pass. If .opencode/verification-checklist.md exists, every item must pass.
Work autonomously; ask a concise question only when truly blocked and the OpenCode question permission allows it.
</orchestrator_mission_loop>`;
}

function buildActiveSessionPrompt(stepCount: number): string {
    return `<orchestrator_session>
Steps executed: ${stepCount}. Continue autonomously.
</orchestrator_session>`;
}

function buildBackgroundTasksPrompt(running: number, pending: number): string {
    return `<orchestrator_background_tasks>
- Running: ${running}
- Pending: ${pending}
Check finished tasks with get_task_result; delegate_task with background=true runs work in parallel.
</orchestrator_background_tasks>`;
}
