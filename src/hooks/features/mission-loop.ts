
/**
 * Mission Loop Hook
 * 
 * Handles:
 * - Mission seal detection (Stop)
 * - Auto-continuation injection (Loop)
 * - User cancellation detection
 * 
 * Refactored to use SessionManager and SystemMessages for better maintainability.
 */
import type { AssistantDoneHook, ChatMessageHook, HookContext, HookResult } from "../types.js";
import { log } from "../../core/agents/logger.js";
import {
    startMissionLoop,
    cancelMissionLoop,
    detectSealInText,
    isLoopActive,
    clearLoopState,
} from "../../core/loop/mission-seal.js";
import { PROMPTS, COMMAND_NAMES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import * as Toast from "../../core/notification/toast.js";
import * as ProgressTracker from "../../core/progress/tracker.js";
import { formatTimestamp, formatElapsedTime, detectSlashCommand } from "../../utils/common.js";
import { COMMANDS } from "../../tools/slashCommand.js";

// Refactored Imports
import {
    ensureSessionInitialized,
    activateMissionState,
    isMissionActive
} from "../../core/orchestrator/session-manager.js";
import {
    MISSION_MESSAGES,
    CONTINUE_INSTRUCTION
} from "../../shared/constants/system-messages.js";

export class MissionControlHook implements AssistantDoneHook, ChatMessageHook {
    name = HOOK_NAMES.MISSION_LOOP;

    async execute(ctx: HookContext, text: string): Promise<any> {
        // 1. Try to handle as a Chat Command (/task)
        const chatResult = await this.handleChatCommand(ctx, text);
        if (chatResult) return chatResult;

        // 2. If not a command, treat as Agent Output (check for Seal)
        return this.handleMissionSeal(ctx, text);
    }

    // -------------------------------------------------------------------------------
    // 1. Chat Logic: Detect /task & Initialize
    // -------------------------------------------------------------------------------
    private async handleChatCommand(ctx: HookContext, message: string): Promise<any | null> {
        const parsed = detectSlashCommand(message);
        if (!parsed || parsed.command !== COMMAND_NAMES.TASK) return null;

        const command = COMMANDS[parsed.command];
        const { sessionID, sessions, directory } = ctx;

        log(MISSION_MESSAGES.START_LOG);

        // 1. Initialize Session State (Local)
        ensureSessionInitialized(sessions, sessionID);

        // 2. Activate Mission State (Global)
        activateMissionState(sessionID);

        // 3. Start Loop
        const prompt = parsed.args || "continue from where we left off";
        startMissionLoop(directory, sessionID, prompt);
        ProgressTracker.startSession(sessionID);

        // 4. Modify Message (Template Replacement)
        if (command) {
            const modifiedMessage = command.template.replace(
                /\$ARGUMENTS/g,
                parsed.args || PROMPTS.CONTINUE
            );
            return { action: HOOK_ACTIONS.PROCESS, modifiedMessage };
        }

        return { action: HOOK_ACTIONS.PROCESS };
    }

    // -------------------------------------------------------------------------------
    // 2. Done Logic: Check Seal & Auto-Continue
    // -------------------------------------------------------------------------------
    private async handleMissionSeal(ctx: HookContext, agentText: string): Promise<any> {
        const { sessionID, directory, sessions } = ctx;
        const session = sessions.get(sessionID);

        // 1. Validate Active State
        if (!isMissionActive(sessionID)) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        if (!isLoopActive(directory, sessionID)) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        const finalText = agentText || "";

        // 2. User Cancellation
        if (finalText.includes(MISSION_MESSAGES.STOP_TRIGGER) || finalText.includes(MISSION_MESSAGES.CANCEL_TRIGGER)) {
            log(MISSION_MESSAGES.CANCEL_LOG);
            await cancelMissionLoop(directory, sessionID);
            return { action: HOOK_ACTIONS.STOP, reason: "User cancelled via text" };
        }

        // 3. Mission Seal Check
        if (detectSealInText(finalText)) {
            log(MISSION_MESSAGES.SEAL_LOG);
            clearLoopState(directory);

            // Use TaskToastManager for consistent and enhanced TUI feedback
            const toastManager = Toast.getTaskToastManager();
            if (toastManager) {
                toastManager.showMissionSealedToast(
                    MISSION_MESSAGES.TOAST_COMPLETE_TITLE,
                    MISSION_MESSAGES.TOAST_COMPLETE_MESSAGE
                );
            } else {
                // Fallback if manager not initialized
                await Toast.show({
                    title: MISSION_MESSAGES.TOAST_COMPLETE_TITLE,
                    message: MISSION_MESSAGES.TOAST_COMPLETE_MESSAGE,
                    variant: "success"
                });
            }

            return { action: HOOK_ACTIONS.STOP, reason: "Mission Sealed" };
        }

        // 4. Auto-Continuation Injection
        const now = Date.now();
        const stepDuration = formatElapsedTime(session.lastStepTime, now);
        const totalElapsed = formatElapsedTime(session.startTime, now);
        const currentTime = formatTimestamp();

        const progressInfo = ProgressTracker.formatCompact(sessionID);

        const continuePrompt = CONTINUE_INSTRUCTION +
            `\n\n[${currentTime}] Step ${session.step} | ${progressInfo} | This step: ${stepDuration} | Total: ${totalElapsed}`;

        return {
            action: HOOK_ACTIONS.INJECT,
            prompts: [continuePrompt]
        };
    }
}
