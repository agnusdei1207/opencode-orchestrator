import type { ChatMessageHook, ChatMessageResult, HookContext } from "../registry.js";
import { startMissionLoop, cancelMissionLoop, readLoopState } from "../../core/loop/mission-loop.js";
import { PROMPTS, COMMAND_NAMES } from "../../shared/index.js";
import { ParallelAgentManager } from "../../core/agents/manager.js";
import { isSessionBusy } from "../../core/session/activity.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import * as ProgressTracker from "../../core/progress/tracker.js";
import { detectSlashCommand } from "../../utils/parsing/index.js";
import { COMMANDS } from "../../tools/slashCommand.js";
import {
    ensureSessionInitialized,
    activateMissionState,
    deactivateMissionState,
} from "../../core/orchestrator/session-manager.js";
import { handleAbort, handleUserMessage } from "../../core/loop/mission-loop-handler.js";
import { clearPrompts } from "../../core/session/pending-injection.js";

// Chat commands own mission activation; the idle handler owns continuation and completion.
export class MissionControlHook implements ChatMessageHook {
    name = HOOK_NAMES.MISSION_LOOP;

    async execute(ctx: HookContext, message: string): Promise<ChatMessageResult> {
        const parsed = detectSlashCommand(message);
        if (!parsed) return { action: HOOK_ACTIONS.PROCESS };

        if (parsed.command === COMMAND_NAMES.CANCEL || parsed.command === COMMAND_NAMES.STOP) {
            cancelMissionLoop(ctx.directory, ctx.sessionID);
            deactivateOwnedSession(ctx, ctx.sessionID);
            return { action: HOOK_ACTIONS.INTERCEPT };
        }
        if (parsed.command !== COMMAND_NAMES.TASK) return { action: HOOK_ACTIONS.PROCESS };

        const { sessionID, sessions, directory } = ctx;
        const previous = readLoopState(directory);
        if (previous?.active && previous.sessionID !== sessionID) {
            await prepareReplacement(ctx, previous.sessionID);
        }
        if (!startMissionLoop(directory, sessionID, parsed.args || "continue from where we left off", {
            replaceExisting: previous?.active ? previous : undefined,
        })) {
            throw new Error("Could not persist the mission; activation stopped");
        }
        if (previous?.active && previous.sessionID !== sessionID) {
            deactivateOwnedSession(ctx, previous.sessionID);
        }
        ensureSessionInitialized(sessions, sessionID, directory).active = true;
        activateMissionState(sessionID);
        handleUserMessage(sessionID);
        ProgressTracker.startSession(sessionID);
        const command = COMMANDS[parsed.command];
        return {
            action: HOOK_ACTIONS.PROCESS,
            modifiedMessage: command?.template.replace(/\$ARGUMENTS/g, parsed.args || PROMPTS.CONTINUE),
        };
    }
}

async function prepareReplacement(ctx: HookContext, ownerID: string): Promise<void> {
    if (!ctx.client) throw new Error("Cannot replace the active mission without a session client");
    if (await isSessionBusy(ctx.client, ownerID)) {
        const response = await ctx.client.session.abort({ path: { id: ownerID } });
        if (response.error || response.data !== true) {
            throw new Error(`Could not abort the active session ${ownerID}; mission unchanged`);
        }
    }
    handleAbort(ownerID);
    const manager = ParallelAgentManager.getInstance();
    if (!(await manager.cancelTasksForParent(ownerID))) {
        throw new Error(`Could not cancel all delegated tasks for ${ownerID}; mission unchanged`);
    }
}

function deactivateOwnedSession(ctx: HookContext, sessionID: string): void {
    handleAbort(sessionID);
    clearPrompts(sessionID);
    deactivateMissionState(sessionID);
    ProgressTracker.clearSession(sessionID);
    const session = ctx.sessions.get(sessionID);
    if (typeof session !== "object" || session === null) return;
    const managed = session as Record<string, unknown>;
    managed.active = false;
    managed.lastAbortAt = Date.now();
}
