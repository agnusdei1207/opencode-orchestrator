import type { ChatMessageHook, ChatMessageResult, HookContext } from "../registry.js";
import { startMissionLoop, cancelMissionLoop } from "../../core/loop/mission-loop.js";
import { PROMPTS, COMMAND_NAMES } from "../../shared/index.js";
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
            handleAbort(ctx.sessionID);
            clearPrompts(ctx.sessionID);
            deactivateMissionState(ctx.sessionID);
            ProgressTracker.clearSession(ctx.sessionID);
            const session = ctx.sessions.get(ctx.sessionID);
            if (typeof session === "object" && session !== null) {
                const managed = session as Record<string, unknown>;
                managed.active = false;
                managed.lastAbortAt = Date.now();
            }
            return { action: HOOK_ACTIONS.INTERCEPT };
        }
        if (parsed.command !== COMMAND_NAMES.TASK) return { action: HOOK_ACTIONS.PROCESS };

        const { sessionID, sessions, directory } = ctx;
        if (!startMissionLoop(directory, sessionID, parsed.args || "continue from where we left off")) {
            throw new Error("Could not persist the mission; activation stopped");
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
