/**
 * Tool Execute Handler
 * 
 * Handles tool.execute.after hook:
 * - Sanity checks for LLM output
 * - Task status tracking
 * - Progress display
 */

import { log } from "../core/agents/logger.js";
import { state } from "../core/orchestrator/index.js";
import { checkOutputSanity, RECOVERY_PROMPT, ESCALATION_PROMPT } from "../utils/sanity/index.js";
import { formatTimestamp, formatElapsedTime } from "../utils/common.js";
import { TOOL_NAMES, TOOL_OUTPUT } from "../shared/index.js";
import type { ToolExecuteHandlerContext } from "./interfaces/index.js";

export type { ToolExecuteHandlerContext } from "./interfaces/index.js";

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

        const now = Date.now();
        const stepDuration = formatElapsedTime(session.lastStepTime, now);
        const totalElapsed = formatElapsedTime(session.startTime, now);
        session.step++;
        session.timestamp = now;
        session.lastStepTime = now;

        const stateSession = state.sessions.get(toolInput.sessionID);

        // Sanity check
        if (toolInput.tool === TOOL_NAMES.CALL_AGENT && stateSession) {
            const sanityResult = checkOutputSanity(toolOutput.output);

            if (!sanityResult.isHealthy) {
                stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
                const agentName = toolInput.arguments?.agent as string || "unknown";

                toolOutput.output = `[${agentName.toUpperCase()}] OUTPUT ANOMALY DETECTED\n\n` +
                    `Gibberish/loop detected: ${sanityResult.reason}\n` +
                    `Anomaly count: ${stateSession.anomalyCount}\n\n` +
                    (stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT);

                return;
            } else {
                if (stateSession.anomalyCount > 0) {
                    stateSession.anomalyCount = 0;
                }
                if (toolOutput.output.length < TOOL_OUTPUT.SMALL_OUTPUT_THRESHOLD) {
                    stateSession.lastHealthyOutput = toolOutput.output.substring(0, TOOL_OUTPUT.MAX_HEALTHY_OUTPUT_LENGTH);
                }
            }
        }

        // Track task and add agent header
        if (toolInput.tool === TOOL_NAMES.CALL_AGENT && toolInput.arguments?.task && stateSession) {
            const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
            if (taskIdMatch) {
                stateSession.currentTask = taskIdMatch[1].toUpperCase();
            }

            const agentName = toolInput.arguments.agent as string;
            const indicator = agentName[0].toUpperCase();
            toolOutput.output = `[${indicator}] [${agentName.toUpperCase()}] Working...\n\n` + toolOutput.output;
        }

        // Task status tracking
        if (stateSession) {
            const taskId = stateSession.currentTask;

            if (toolOutput.output.includes("PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
                if (taskId) {
                    stateSession.taskRetries.clear();
                    toolOutput.output += `\n\n${taskId} VERIFIED`;
                }
            } else if (toolOutput.output.includes("FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
                if (taskId) {
                    const retries = (stateSession.taskRetries.get(taskId) || 0) + 1;
                    stateSession.taskRetries.set(taskId, retries);
                    if (retries >= state.maxRetries) {
                        toolOutput.output += `\n\n${taskId} FAILED (${retries}x)`;
                    } else {
                        toolOutput.output += `\n\nRETRY ${retries}/${state.maxRetries}`;
                    }
                }
            }
        }

        const currentTime = formatTimestamp();
        toolOutput.output += `\n\n[${currentTime}] Step ${session.step} | This step: ${stepDuration} | Total: ${totalElapsed}`;
    };
}
