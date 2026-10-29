import type { ChatMessageHook, ChatMessageResult, HookContext } from "../registry.js";
import { startMissionLoop, cancelMissionLoop, readLoopState } from "../../core/loop/mission-loop.js";
import { PROMPTS, COMMAND_NAMES } from "../../shared/index.js";
import { isSessionBusy } from "../../core/session/activity.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import { detectSlashCommand } from "../../utils/parsing/index.js";
import { COMMANDS } from "../../tools/slashCommand.js";
import { ensureSessionInitialized } from "../../core/orchestrator/session-manager.js";
import { cleanupSession, handleAbort, handleUserMessage } from "../../core/loop/mission-loop-handler.js";
import { clearPrompts } from "../../core/session/pending-injection.js";

// Chat commands own mission activation; the idle handler owns continuation and completion.
export class MissionControlHook implements ChatMessageHook {
    name = HOOK_NAMES.MISSION_LOOP;

    async execute(ctx: HookContext, message: string): Promise<ChatMessageResult> {
        const parsed = detectSlashCommand(message);
        if (!parsed) return { action: HOOK_ACTIONS.PROCESS };

        if (parsed.command === COMMAND_NAMES.CANCEL || parsed.command === COMMAND_NAMES.STOP) {
            cancelMissionLoop(ctx.directory, ctx.sessionID);
            // A cancelled mission must not leave its stagnation or evidence to the next one.
            cleanupSession(ctx.sessionID);
            deactivateOwnedSession(ctx, ctx.sessionID);
            return { action: HOOK_ACTIONS.INTERCEPT };
        }
        if (parsed.command !== COMMAND_NAMES.TASK) return { action: HOOK_ACTIONS.PROCESS };

        await activateTaskMission(ctx, parsed.args);
        const command = COMMANDS[parsed.command];
        return {
            action: HOOK_ACTIONS.PROCESS,
            modifiedMessage: command?.template.replace(/\$ARGUMENTS/g, parsed.args || PROMPTS.CONTINUE),
        };
    }
}

type LoopState = ReturnType<typeof readLoopState>;

/** The active mission owned by another session, which this /task must replace. */
function foreignActiveOwner(previous: LoopState, sessionID: string): string | null {
    if (previous?.active && previous.sessionID !== sessionID) return previous.sessionID;
    return null;
}

async function activateTaskMission(ctx: HookContext, args: string): Promise<void> {
    const { sessionID, sessions, directory } = ctx;
    const previous = readLoopState(directory);
    const replacedOwner = foreignActiveOwner(previous, sessionID);
    if (replacedOwner !== null) {
        await prepareReplacement(ctx, replacedOwner);
    }
    // A new mission starts without the previous one's stagnation count or evidence.
    cleanupSession(sessionID);
    if (!startMissionLoop(directory, sessionID, args || PROMPTS.CONTINUE_DEFAULT, {
        replaceExisting: previous?.active ? previous : undefined,
    })) {
        throw new Error("Could not persist the mission; activation stopped");
    }
    if (replacedOwner !== null) {
        deactivateOwnedSession(ctx, replacedOwner);
    }
    ensureSessionInitialized(sessions, sessionID, directory).active = true;
    handleUserMessage(sessionID);
}

async function prepareReplacement(ctx: HookContext, ownerID: string): Promise<void> {
    if (!ctx.client) throw new Error("Cannot replace the active mission without a session client");
    const client = ctx.client;
    if (await isSessionBusy(client, ownerID)) {
        if (!(await client.interrupt(ownerID))) {
            throw new Error(`Could not abort the active session ${ownerID}; mission unchanged`);
        }
    }
    handleAbort(ownerID);
    const children = ctx.children?.busyChildren(client, ownerID) ?? [];
    const stopped = await Promise.all(children.map(childID => client.interrupt(childID)));
    if (stopped.includes(false)) {
        throw new Error(`Could not stop all delegated sessions of ${ownerID}; mission unchanged`);
    }
}

function deactivateOwnedSession(ctx: HookContext, sessionID: string): void {
    handleAbort(sessionID);
    clearPrompts(sessionID);
    const session = ctx.sessions.get(sessionID);
    if (!session) return;
    session.active = false;
    session.lastAbortAt = Date.now();
}
