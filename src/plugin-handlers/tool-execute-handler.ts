/**
 * Tool Execute Handler
 * 
 * Handles tool.execute.after hook:
 * - Sanity checks for LLM output
 * - Task status tracking
 * - Progress display
 */

import { log } from "../core/agents/logger.js";
import { recordToolEvidence } from "../core/loop/evidence.js";
import { formatElapsedTime, formatTimestamp } from "../utils/formatting/index.js";
import { HookRegistry } from "../hooks/registry.js";
import type { PluginSessionState, ToolExecuteHandlerContext } from "./context.js";
import { isRecord } from "../shared/core/guards.js";

export interface ToolExecuteAfterInput {
    sessionID: string;
    tool: string;
    callID: string;
    args: unknown;
}

export interface ToolExecuteAfterOutput {
    title: string;
    output: string;
    metadata: Record<string, unknown>;
}

/**
 * Create tool.execute.after handler
 */
export function createToolExecuteAfterHandler(ctx: ToolExecuteHandlerContext, customRendering = true) {
    const { sessions, directory, contextLimits } = ctx;
    const hooks = HookRegistry.getInstance();
    return async (
        toolInput: ToolExecuteAfterInput,
        toolOutput: ToolExecuteAfterOutput
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return;

        const { stepDuration, totalElapsed } = advanceSessionStep(session);
        const toolArguments = readToolArgs(toolInput.args);
        recordToolEvidence(toolInput.sessionID, toolInput.tool, toolArguments);

        await hooks.executePostTool(
            {
                sessionID: toolInput.sessionID,
                callID: toolInput.callID,
                agent: session.agent,
                directory,
                sessions,
                contextLimits,
            },
            toolInput.tool,
            toolArguments,
            toolOutput
        );
        log(`[tool.execute.after] Completed ${toolInput.tool}`, {
            sessionID: toolInput.sessionID,
            step: session.step,
            duration: stepDuration,
            total: totalElapsed
        });

        if (customRendering) {
            const currentTime = formatTimestamp();
            toolOutput.output += `\n\n[${currentTime}] Step ${session.step} | This step: ${stepDuration} | Total: ${totalElapsed}`;
        }
    };
}

/** Counts the finished tool call as a step; durations are measured before the clock advances. */
function advanceSessionStep(session: PluginSessionState): { stepDuration: string; totalElapsed: string } {
    const now = Date.now();
    const stepDuration = formatElapsedTime(session.lastStepTime, now);
    const totalElapsed = formatElapsedTime(session.startTime, now);
    session.step++;
    session.timestamp = now;
    session.lastStepTime = now;

    if (!session.tokens) {
        session.tokens = { totalInput: 0, totalOutput: 0 };
    }
    return { stepDuration, totalElapsed };
}

function readToolArgs(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}
