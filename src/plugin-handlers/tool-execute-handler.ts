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
import type { ToolExecuteHandlerContext, ToolHookInput, ToolHookOutput } from "./interfaces/index.js";

export type { ToolExecuteHandlerContext } from "./interfaces/index.js";

/**
 * Create tool.execute.after handler
 */
export function createToolExecuteAfterHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (
        toolInput: ToolHookInput,
        toolOutput: ToolHookOutput
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return;

        const now = Date.now();
        const stepDuration = formatElapsedTime(session.lastStepTime, now);
        const totalElapsed = formatElapsedTime(session.startTime, now);
        session.step++;
        session.timestamp = now;
        session.lastStepTime = now;

        if (!session.tokens) {
            session.tokens = { totalInput: 0, totalOutput: 0, estimatedCost: 0 };
        }

        const toolArguments = toolInput.arguments || {};
        recordToolCall(toolInput.sessionID, toolInput.tool);
        recordToolEvidence(toolInput.sessionID, toolInput.tool, toolArguments);

        // Execute Hooks
        await hooks.executePostTool(
            {
                sessionID: toolInput.sessionID,
                directory,
                sessions
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

        const currentTime = formatTimestamp();
        toolOutput.output += `\n\n[${currentTime}] Step ${session.step} | This step: ${stepDuration} | Total: ${totalElapsed}`;
    };
}
