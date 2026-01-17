/**
 * Plugin Handlers - Assistant Done Handler
 * 
 * Handles assistant.done hook:
 * - Sanity checks for final response
 * - Mission seal detection
 * - Continuation prompt injection
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { state } from "../core/orchestrator/index.js";
import { checkOutputSanity, RECOVERY_PROMPT, ESCALATION_PROMPT } from "../utils/sanity.js";
import { formatTimestamp, formatElapsedTime } from "../utils/common.js";
import { MISSION, MISSION_SEAL, PART_TYPES, PROMPTS } from "../shared/index.js";
import { detectSealInText, isLoopActive, clearLoopState } from "../core/loop/mission-seal.js";
import * as Toast from "../core/notification/toast.js";
import * as ProgressTracker from "../core/progress/tracker.js";
import type { SessionState } from "./event-handler.js";

type OpencodeClient = PluginInput["client"];

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
- All features are implemented and tested
- Final verification passes
Then output: ${MISSION_SEAL.PATTERN}
</completion_criteria>
</auto_continue>`;

export interface AssistantDoneHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, SessionState>;
}

/**
 * Create assistant.done handler
 */
export function createAssistantDoneHandler(ctx: AssistantDoneHandlerContext) {
    const { client, directory, sessions } = ctx;

    return async (assistantInput: any, assistantOutput: any) => {
        const sessionID = assistantInput.sessionID;
        const session = sessions.get(sessionID);

        if (!session?.active) return;

        // Gather all the text from the response
        const parts = assistantOutput.parts as Array<{ type: string; text?: string }> | undefined;
        const textContent = parts
            ?.filter((p: any) => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
            .map((p: any) => p.text || "")
            .join("\n") || "";

        const stateSession = state.sessions.get(sessionID);

        // =========================================================
        // SANITY CHECK (for the final response)
        // =========================================================
        const sanityResult = checkOutputSanity(textContent);
        if (!sanityResult.isHealthy && stateSession) {
            stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
            session.step++;
            session.timestamp = Date.now();

            const recoveryText = stateSession.anomalyCount >= 2
                ? ESCALATION_PROMPT
                : RECOVERY_PROMPT;

            try {
                if (client?.session?.prompt) {
                    await client.session.prompt({
                        path: { id: sessionID },
                        body: {
                            parts: [{
                                type: PART_TYPES.TEXT,
                                text: `⚠️ ANOMALY #${stateSession.anomalyCount}: ${sanityResult.reason}\n\n` +
                                    recoveryText +
                                    `\n\n[Recovery Step ${session.step}]`
                            }],
                        },
                    });
                }
            } catch {
                session.active = false;
                state.missionActive = false;
            }
            return;
        }

        // Good response, reset the anomaly counter
        if (stateSession && stateSession.anomalyCount > 0) {
            stateSession.anomalyCount = 0;
        }

        // =========================================================
        // COMPLETION CHECK
        // Only check for Mission Seal if this session has an active loop
        // =========================================================

        // Check for Mission Seal - ONLY if loop is active for this session
        if (isLoopActive(directory, sessionID) && detectSealInText(textContent)) {
            session.active = false;
            state.missionActive = false;

            clearLoopState(directory);

            Toast.presets.missionComplete("🎖️ Mission Sealed - Explicit completion confirmed");

            log("[assistant-done-handler] Mission sealed detected", { sessionID });

            ProgressTracker.clearSession(sessionID);

            sessions.delete(sessionID);
            state.sessions.delete(sessionID);
            return;
        }

        // Let users bail out manually if needed
        if (textContent.includes(MISSION.STOP_COMMAND) || textContent.includes(MISSION.CANCEL_COMMAND)) {
            session.active = false;
            state.missionActive = false;

            Toast.presets.taskFailed(sessionID, "Cancelled by user");

            ProgressTracker.clearSession(sessionID);

            sessions.delete(sessionID);
            state.sessions.delete(sessionID);
            return;
        }

        const now = Date.now();
        const stepDuration = formatElapsedTime(session.lastStepTime, now);
        const totalElapsed = formatElapsedTime(session.startTime, now);
        session.step++;
        session.timestamp = now;
        session.lastStepTime = now;
        const currentTime = formatTimestamp();

        // NOTE: No step limit check - using event-based continuation

        // =========================================================
        // THE RELENTLESS LOOP
        // Mission not complete? Inject a "keep going" prompt.
        // Event-based continuation in session.idle will also handle this.
        // =========================================================

        // Record progress snapshot
        ProgressTracker.recordSnapshot(sessionID, {
            currentStep: session.step,
        });

        // Get progress info
        const progressInfo = ProgressTracker.formatCompact(sessionID);

        try {
            if (client?.session?.prompt) {
                await client.session.prompt({
                    path: { id: sessionID },
                    body: {
                        parts: [{
                            type: PART_TYPES.TEXT,
                            text: CONTINUE_INSTRUCTION + `\n\n⏱️ [${currentTime}] Step ${session.step} | ${progressInfo} | This step: ${stepDuration} | Total: ${totalElapsed}`
                        }],
                    },
                });
            }
        } catch (error) {
            // First attempt failed, wait a bit and try simpler prompt
            log("[assistant-done-handler] Continuation injection failed, retrying...", { sessionID, error });
            try {
                await new Promise(r => setTimeout(r, 500));
                if (client?.session?.prompt) {
                    await client.session.prompt({
                        path: { id: sessionID },
                        body: { parts: [{ type: PART_TYPES.TEXT, text: PROMPTS.CONTINUE }] },
                    });
                }
            } catch (retryError) {
                // Both failed - but DON'T stop the session immediately!
                // Let MissionSealHandler or TodoContinuation handle via session.idle
                log("[assistant-done-handler] Both continuation attempts failed, waiting for idle handler", {
                    sessionID,
                    error: retryError,
                    loopActive: isLoopActive(directory, sessionID)
                });
                // Only stop if loop is not active
                if (!isLoopActive(directory, sessionID)) {
                    log("[assistant-done-handler] No active loop, stopping session", { sessionID });
                    session.active = false;
                    state.missionActive = false;
                }
            }
        }
    };
}
