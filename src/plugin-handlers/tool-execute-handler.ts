/**
 * Plugin Handlers - Tool Execute Handler
 * 
 * Handles tool.execute.after hook:
 * - Sanity checks for LLM output
 * - Task status tracking
 * - Progress display
 */

import { log } from "../core/agents/logger.js";
import { state } from "../core/orchestrator/index.js";
import { checkOutputSanity, RECOVERY_PROMPT, ESCALATION_PROMPT } from "../utils/sanity.js";
import { formatTimestamp, formatElapsedTime } from "../utils/common.js";
import { TOOL_NAMES, AGENT_EMOJI } from "../shared/constants.js";
import type { SessionState } from "./event-handler.js";

export interface ToolExecuteHandlerContext {
    sessions: Map<string, SessionState>;
}

/**
 * Create tool.execute.after handler
 */
export function createToolExecuteAfterHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions } = ctx;

    return async (
        toolInput: { tool: string; sessionID: string; callID: string; arguments?: any },
        toolOutput: { title: string; output: string; metadata: any }
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return;

        // Tick the step counter and track timing
        const now = Date.now();
        const stepDuration = formatElapsedTime(session.lastStepTime, now);
        const totalElapsed = formatElapsedTime(session.startTime, now);
        session.step++;
        session.timestamp = now;
        session.lastStepTime = now;

        const stateSession = state.sessions.get(toolInput.sessionID);

        // =========================================================
        // SANITY CHECK
        // Detect if the LLM output is gibberish or stuck in a loop
        // =========================================================
        if (toolInput.tool === TOOL_NAMES.CALL_AGENT && stateSession) {
            const sanityResult = checkOutputSanity(toolOutput.output);

            if (!sanityResult.isHealthy) {
                stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
                const agentName = toolInput.arguments?.agent as string || "unknown";

                toolOutput.output = `⚠️ [${agentName.toUpperCase()}] OUTPUT ANOMALY DETECTED\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚠️ Gibberish/loop detected: ${sanityResult.reason}\n` +
                    `Anomaly count: ${stateSession.anomalyCount}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    (stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT);

                return;
            } else {
                if (stateSession.anomalyCount > 0) {
                    stateSession.anomalyCount = 0;
                }
                if (toolOutput.output.length < 5000) {
                    stateSession.lastHealthyOutput = toolOutput.output.substring(0, 1000);
                }
            }
        }

        // Track which task is running and add agent header
        if (toolInput.tool === TOOL_NAMES.CALL_AGENT && toolInput.arguments?.task && stateSession) {
            const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
            if (taskIdMatch) {
                stateSession.currentTask = taskIdMatch[1].toUpperCase();
            }

            const agentName = toolInput.arguments.agent as string;
            const emoji = AGENT_EMOJI[agentName] || "🤖";
            toolOutput.output = `${emoji} [${agentName.toUpperCase()}] Working...\n\n` + toolOutput.output;
        }

        // NOTE: No step limit check here - we use event-based continuation
        // Mission continues via session.idle events until seal detected

        // =========================================================
        // TASK STATUS TRACKING (simplified - no DAG)
        // Watch for PASS/FAIL signals from Reviewer
        // =========================================================
        if (stateSession) {
            const taskId = stateSession.currentTask;

            // Reviewer said PASS - clear retry counter
            if (toolOutput.output.includes("✅ PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
                if (taskId) {
                    stateSession.taskRetries.clear();
                    toolOutput.output += `\n\n━━━━━━━━━━━━\n✅ ${taskId} VERIFIED`;
                }
            }
            // Reviewer said FAIL - increment retry counter
            else if (toolOutput.output.includes("❌ FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
                if (taskId) {
                    const retries = (stateSession.taskRetries.get(taskId) || 0) + 1;
                    stateSession.taskRetries.set(taskId, retries);
                    if (retries >= state.maxRetries) {
                        toolOutput.output += `\n\n━━━━━━━━━━━━\n⚠️ ${taskId} FAILED (${retries}x)`;
                    } else {
                        toolOutput.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries}`;
                    }
                }
            }
        }

        // Always show the step counter with timestamp at the bottom
        const currentTime = formatTimestamp();
        toolOutput.output += `\n\n⏱️ [${currentTime}] Step ${session.step} | This step: ${stepDuration} | Total: ${totalElapsed}`;
    };
}
