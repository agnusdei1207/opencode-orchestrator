
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
import { PROMPTS, COMMAND_NAMES, TOAST_VARIANTS } from "../../shared/index.js";
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
    buildVerificationSummary
} from "../../core/loop/verification.js";
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
        const finalText = agentText || "";

        // 0. CRITICAL: Check TODO completion FIRST (before mission state checks)
        // This ensures we NEVER stop when work remains, even if mission state is wrong
        const preVerification = verifyMissionCompletion(directory);

        if (!preVerification.todoComplete && preVerification.todoProgress !== "0/0") {
            // TODO exists and has incomplete items → FORCE continuation
            log("[MissionControl] TODO incomplete - forcing continuation", {
                todoProgress: preVerification.todoProgress,
                todoIncomplete: preVerification.todoIncomplete
            });

            // Check for SEAL attempt despite incomplete TODO
            if (detectSealInText(finalText)) {
                log("[MissionControl] SEAL detected but TODO incomplete - REJECTED");
                return {
                    action: HOOK_ACTIONS.INJECT,
                    prompts: [buildVerificationFailurePrompt(preVerification)]
                };
            }

            // No SEAL, just continue working - inject continuation prompt
            const continuePrompt = `⚠️ **TODO Incomplete: ${preVerification.todoProgress}**

${preVerification.todoIncomplete} task(s) remaining. Continue working on incomplete items.

**REQUIRED**: Check TODO.md and complete ALL [ ] items before attempting SEAL.

\`\`\`bash
cat .opencode/todo.md
\`\`\`

**DO NOT** output <mission_seal> until ALL items are [x].`;

            return {
                action: HOOK_ACTIONS.INJECT,
                prompts: [continuePrompt]
            };
        }

        // 1. Validate Active State (only after confirming TODO is complete or empty)
        if (!isMissionActive(sessionID)) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        if (!isLoopActive(directory, sessionID)) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        // 2. User Cancellation
        if (finalText.includes(MISSION_MESSAGES.STOP_TRIGGER) || finalText.includes(MISSION_MESSAGES.CANCEL_TRIGGER)) {
            log(MISSION_MESSAGES.CANCEL_LOG);
            await cancelMissionLoop(directory, sessionID);
            return { action: HOOK_ACTIONS.STOP, reason: "User cancelled via text" };
        }

        // 3. Mission Seal Check with Verification Gate
        if (detectSealInText(finalText)) {
            // ⚠️ VERIFICATION GATE: Check actual completion conditions
            const verification = verifyMissionCompletion(directory);

            if (!verification.passed) {
                // Verification FAILED - reject SEAL and continue loop
                log("[MissionControl] SEAL detected but verification FAILED", {
                    todoProgress: verification.todoProgress,
                    todoComplete: verification.todoComplete,
                    syncIssuesEmpty: verification.syncIssuesEmpty,
                    errors: verification.errors
                });

                // Inject rejection prompt to force continuation
                return {
                    action: HOOK_ACTIONS.INJECT,
                    prompts: [buildVerificationFailurePrompt(verification)]
                };
            }

            // ✅ Verification PASSED - allow mission completion
            log(MISSION_MESSAGES.SEAL_LOG + " " + buildVerificationSummary(verification));
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
                    variant: TOAST_VARIANTS.SUCCESS
                });
            }

            // 🎉 OS Notification - Only sent when verification PASSES
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

            return { action: HOOK_ACTIONS.STOP, reason: "Mission Sealed (Verified)" };
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
