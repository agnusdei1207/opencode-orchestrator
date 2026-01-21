
/**
 * Mission Loop Hook
 * 
 * Handles:
 * - Mission seal detection (Stop)
 * - Auto-continuation injection (Loop)
 * - User cancellation detection
 */
import type { AssistantDoneHook, ChatMessageHook, HookContext, HookResult } from "../types.js";
import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../core/agents/logger.js";
import {
    startMissionLoop,
    cancelMissionLoop,
    type MissionLoopState,
    detectSealInText,
    isLoopActive,
    clearLoopState,
    SEAL_PATTERN // Import constant
} from "../../core/loop/mission-seal.js";
import { PROMPTS, PART_TYPES, COMMAND_NAMES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import * as Toast from "../../core/notification/toast.js";
import * as ProgressTracker from "../../core/progress/tracker.js";
import { formatTimestamp, formatElapsedTime, detectSlashCommand } from "../../utils/common.js";
import { COMMANDS } from "../../tools/slashCommand.js";
import { state } from "../../core/orchestrator/state.js"; // Import global state

// Auto-continue prompt for mission loop
const CONTINUE_INSTRUCTION = `<auto_continue>
<status>Mission not complete. Keep executing.</status>

<rules>
1. DO NOT stop - mission is incomplete
2. DO NOT wait for user input
3. If previous action failed, try different approach
4. If agent returned nothing, proceed to next step
5. Check your todo list - complete ALL pending items
</rules>

<next_step>
1. Check todo list for incomplete items
2. Identify the highest priority pending task
3. Execute it NOW
4. Mark complete when done
5. Continue until ALL todos are complete
</next_step>

<completion_criteria>
You are ONLY done when:
- All todos are marked complete or cancelled
- All features are implemented and tesWait:
1. Don't ask for permission
2. Check works
3. Only when done:
Then output: ${SEAL_PATTERN}
</completion_criteria>
</auto_continue>`;

export class MissionControlHook implements AssistantDoneHook, ChatMessageHook {
    name = HOOK_NAMES.MISSION_LOOP; // Update usage to MISSION_CONTROL later if desired

    async execute(ctx: HookContext, text: string): Promise<any> {
        // 1. Try to handle as a Chat Command (/task)
        // If it returns a modification or action, return it.
        const chatResult = await this.handleChatCommand(ctx, text);
        if (chatResult) return chatResult;

        // 2. If not a command, treat as Agent Output (check for Seal)
        // Only valid if we are in the Done phase? 
        // HookRegsitry calls this for Chat too. 
        // If user says "hello", chatResult is null.
        // Then we check handleMissionSeal.
        // handleMissionSeal checks if loop is active.
        // If loop is active, and user said "hello", we might accidentally check seal on user text?
        // Wait. `AssistantDone` hook is ONLY called with Agent output.
        // `Chat` hook is ONLY called with User input.
        // But if I register the SAME instance to both, this `execute` runs for both.
        // Distinction: User text vs Agent text.
        // User text usually won't have <mission_seal> (unless user fakes it).
        // Agent text won't have /task (unless agent hallucinates).
        // Safe enough.

        return this.handleMissionSeal(ctx, text);
    }

    // -------------------------------------------------------------------------------
    // 1. Chat Logic: Detect /task
    // -------------------------------------------------------------------------------
    private async handleChatCommand(ctx: HookContext, message: string): Promise<any | null> {
        const parsed = detectSlashCommand(message);
        if (!parsed || parsed.command !== COMMAND_NAMES.TASK) return null;

        const command = COMMANDS[parsed.command];
        const { sessionID, sessions, directory } = ctx;

        log(`[MissionControl] Detected /task command. Starting mission...`);

        // Initialize Session
        if (!sessions.has(sessionID)) {
            const now = Date.now();
            sessions.set(sessionID, {
                active: true,
                step: 0,
                timestamp: now,
                startTime: now,
                lastStepTime: now,
                tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
            });
        }

        // Update Global State
        let stateSession = state.sessions.get(sessionID);
        if (!stateSession) {
            state.sessions.set(sessionID, {
                enabled: true,
                iterations: 0,
                taskRetries: new Map(),
                currentTask: "",
                anomalyCount: 0,
            });
            stateSession = state.sessions.get(sessionID);
        }
        if (stateSession) {
            stateSession.enabled = true;
            stateSession.anomalyCount = 0;
        }
        state.missionActive = true;

        // Start Loop
        const prompt = parsed.args || "continue from where we left off";
        startMissionLoop(directory, sessionID, prompt);
        ProgressTracker.startSession(sessionID);

        // Modify Message
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
    // 2. Done Logic: Check Seal
    // -------------------------------------------------------------------------------
    private async handleMissionSeal(ctx: HookContext, agentText: string): Promise<any> {
        const { sessionID, directory, sessions } = ctx;
        const session = sessions.get(sessionID);

        // If the session is no longer active or mission is not active, just continue.
        // This can happen if cancellation was triggered by another hook or external event.
        const stateSession = state.sessions.get(sessionID);
        if (!stateSession || !state.missionActive) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        // We must check if loop is active first.
        if (!isLoopActive(directory, sessionID)) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        const finalText = agentText || "";

        // 1. User Cancellation (Text-based fallback)
        if (finalText.includes("STOP MISSION") || finalText.includes("CANCEL MISSION")) {
            log("[mission-control] detected user cancellation signal.");
            await cancelMissionLoop(directory, sessionID);
            return { action: HOOK_ACTIONS.STOP, reason: "User cancelled via text" };
        }

        // 2. Mission Seal Check
        if (detectSealInText(finalText)) {
            log("[mission-control] Mission Seal detected! Finishing loop.");
            clearLoopState(directory);
            await Toast.show({
                title: "Mission Complete",
                message: "Agent sealed the mission.",
                variant: "success"
            });
            return { action: HOOK_ACTIONS.STOP, reason: "Mission Sealed" };
        }

        // 3. Auto-Continuation Injection
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
