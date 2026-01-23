
/**
 * Mission Loop Hook
 * 
 * Handles:
 * - Persistent execution until all TODOs are verified
 * - Auto-continuation injection (Loop)
 * - User cancellation detection
 */
import type { AssistantDoneHook, ChatMessageHook, HookContext, HookResult } from "../types.js";
import { log } from "../../core/agents/logger.js";
import {
    startMissionLoop,
    cancelMissionLoop,
    isLoopActive,
    clearLoopState,
} from "../../core/loop/mission-loop.js";
import { PROMPTS, COMMAND_NAMES, TOAST_VARIANTS, MISSION_CONTROL } from "../../shared/index.js";
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
import {
    verifyMissionCompletion,
    buildVerificationFailurePrompt,
    buildTodoIncompletePrompt,
    buildVerificationSummary,
    type VerificationResult
} from "../../core/loop/verification.js";
import { parallelAgentManager } from "../../core/agents/manager.js";

// OS Notification
import { sendNotification } from "../../core/notification/os-notify/notifier.js";
import { playSound } from "../../core/notification/os-notify/sound-player.js";
import { detectPlatform, getDefaultSoundPath } from "../../core/notification/os-notify/platform.js";

export class MissionControlHook implements AssistantDoneHook, ChatMessageHook {
    name = HOOK_NAMES.MISSION_LOOP;

    async execute(ctx: HookContext, text: string): Promise<any> {
        // 1. Try to handle as a Chat Command (/task)
        const chatResult = await this.handleChatCommand(ctx, text);
        if (chatResult) return chatResult;

        // 2. If not a command, treat as Agent Output
        return this.handleMissionProgress(ctx, text);
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
    // 2. Done Logic: Check Completion & Auto-Continue
    // -------------------------------------------------------------------------------
    private async handleMissionProgress(ctx: HookContext, agentText: string): Promise<any> {
        const { sessionID, directory, sessions } = ctx;
        const session = sessions.get(sessionID);
        const finalText = agentText || "";

        // 1. Skip if mission is not active
        if (!isMissionActive(sessionID) || !isLoopActive(directory, sessionID)) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        // 2. User Cancellation
        if (finalText.includes(MISSION_MESSAGES.STOP_TRIGGER) || finalText.includes(MISSION_MESSAGES.CANCEL_TRIGGER)) {
            log(MISSION_MESSAGES.CANCEL_LOG);
            await cancelMissionLoop(directory, sessionID);
            return { action: HOOK_ACTIONS.STOP, reason: "User cancelled via text" };
        }

        // 3. Verification Gate
        const verification = verifyMissionCompletion(directory);

        if (verification.passed) {
            // ✅ Verification PASSED - all tasks done
            return this.handleMissionComplete(directory, verification);
        }

        // 4. Work remains - Force continuation if agent thinks it's done
        // (This hook is called when the assistant is "Done" with a turn)
        log(`[${MISSION_CONTROL.LOG_SOURCE}] Work remains - forcing autonomous continuation`, {
            todo: verification.todoProgress,
            checklist: verification.checklistProgress
        });

        // Use verification failure prompt to guide the agent
        const failurePrompt = verification.checklistProgress !== "0/0"
            ? buildVerificationFailurePrompt(verification)
            : buildTodoIncompletePrompt(verification);

        const continuation = this.buildContinuationResponse(session, sessionID);
        const prompts = [failurePrompt];
        if (continuation.action === HOOK_ACTIONS.INJECT) {
            prompts.push(...continuation.prompts);
        }

        return {
            action: HOOK_ACTIONS.INJECT,
            prompts
        };
    }

    // -------------------------------------------------------------------------------
    // 4. Helper: Build Continuation Response
    // -------------------------------------------------------------------------------
    private buildContinuationResponse(session: any, sessionID: string): HookResult {
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

    // -------------------------------------------------------------------------------
    // 5. Helper: Handle Mission Complete
    // -------------------------------------------------------------------------------
    private async handleMissionComplete(directory: string, verification: VerificationResult): Promise<HookResult> {
        log(MISSION_MESSAGES.COMPLETE_LOG + " " + buildVerificationSummary(verification));
        const cleared = clearLoopState(directory);
        parallelAgentManager.cleanup();

        // Only show UI and send notification if we are the ones who cleared the state
        // This prevents duplicates if multiple handlers run simultaneously (e.g. Idle and Hook)
        if (cleared) {
            // Use TaskToastManager for consistent and enhanced TUI feedback
            const toastManager = Toast.getTaskToastManager();
            if (toastManager) {
                toastManager.showMissionCompleteToast(
                    MISSION_MESSAGES.TOAST_COMPLETE_TITLE,
                    MISSION_MESSAGES.TOAST_COMPLETE_MESSAGE
                );
            } else {
                await Toast.show({
                    title: MISSION_MESSAGES.TOAST_COMPLETE_TITLE,
                    message: MISSION_MESSAGES.TOAST_COMPLETE_MESSAGE,
                    variant: TOAST_VARIANTS.SUCCESS
                });
            }

            // 🎉 OS Notification
            await this.sendCompletionNotification(verification);
        }

        return { action: HOOK_ACTIONS.STOP, reason: "Mission Verified and Complete" };
    }

    // -------------------------------------------------------------------------------
    // 6. Helper: Send OS Notification
    // -------------------------------------------------------------------------------
    private async sendCompletionNotification(verification: VerificationResult): Promise<void> {
        try {
            const platform = detectPlatform();
            const soundPath = getDefaultSoundPath(platform);

            await sendNotification(
                platform,
                "🎖️ Mission Complete!",
                `All verifications passed. ${verification.checklistProgress !== "0/0"
                    ? `Checklist: ${verification.checklistProgress}`
                    : `TODO: ${verification.todoProgress}`}`
            );

            if (soundPath) {
                await playSound(platform, soundPath);
            }
        } catch {
            // OS notification failed, TUI toast was already shown
        }
    }
}
