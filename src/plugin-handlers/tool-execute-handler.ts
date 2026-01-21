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
import { formatElapsedTime, formatTimestamp } from "../utils/common.js";
import { TOOL_NAMES } from "../shared/index.js";
import { HookRegistry } from "../hooks/registry.js"; // Import Registry
import type { ToolExecuteHandlerContext } from "./interfaces/index.js";

export type { ToolExecuteHandlerContext } from "./interfaces/index.js";

/**
 * Create tool.execute.after handler
 */
export function createToolExecuteAfterHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

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

        if (!session.tokens) {
            session.tokens = { totalInput: 0, totalOutput: 0, estimatedCost: 0 };
        }

        const stateSession = state.sessions.get(toolInput.sessionID);

        // Execute Hooks
        await hooks.executePostTool(
            {
                sessionID: toolInput.sessionID,
                directory,
                sessions: sessions as Map<string, any>
            },
            toolInput.tool,
            toolInput.arguments,
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
