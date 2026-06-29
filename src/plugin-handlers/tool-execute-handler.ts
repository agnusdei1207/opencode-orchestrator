/**
 * Tool Execute Handler
 * 
 * Handles tool.execute.after hook:
 * - Sanity checks for LLM output
 * - Task status tracking
 * - Progress display
 */

import { log } from "../core/agents/logger.js";
import { recordToolCall } from "../core/loop/circuit-breaker.js";
import { recordToolEvidence } from "../core/loop/evidence.js";
import { formatElapsedTime, formatTimestamp } from "../utils/common.js";
import { HookRegistry } from "../hooks/registry.js"; // Import Registry
import type { ToolAfterHookInput, ToolArgs, ToolExecuteHandlerContext, ToolHookOutput } from "./interfaces/index.js";

export type { ToolExecuteHandlerContext } from "./interfaces/index.js";

/**
 * Create tool.execute.after handler
 */
export function createToolExecuteAfterHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (
        toolInput: ToolAfterHookInput,
        toolOutput: ToolHookOutput
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return;
        const args = readToolArgs(toolInput);

        const now = Date.now();
        const stepDuration = formatElapsedTime(session.lastStepTime, now);
        const totalElapsed = formatElapsedTime(session.startTime, now);
        session.step++;
        session.timestamp = now;
        session.lastStepTime = now;

        if (!session.tokens) {
            session.tokens = { totalInput: 0, totalOutput: 0, estimatedCost: 0 };
        }

        await hooks.executePostTool(
            {
                sessionID: toolInput.sessionID,
                directory,
                sessions
            },
            toolInput.tool,
            args,
            toolOutput
        );

        recordToolCall(toolInput.sessionID, toolInput.tool);
        recordToolEvidence(toolInput.sessionID, toolInput.tool, args);

        log(`[tool.execute.after] Completed ${toolInput.tool}`, {
            sessionID: toolInput.sessionID,
            step: session.step,
            duration: stepDuration,
            total: totalElapsed
        });

        const currentTime = formatTimestamp();
        toolOutput.output += `\n\n[${currentTime}] Step ${session.step} | This step: ${stepDuration} | Total: ${totalElapsed}`;
    };
}

function readToolArgs(input: ToolAfterHookInput): ToolArgs {
    if (typeof input.args === "object" && input.args !== null && !Array.isArray(input.args)) {
        return input.args;
    }

    return {};
}
