/**
 * Tool Execute Handler
 * 
 * Handles tool.execute.after hook:
 * - Sanity checks for LLM output
 * - Task status tracking
 * - Progress display
 */

import type { Hooks } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { recordToolCall } from "../core/loop/circuit-breaker.js";
import { recordToolEvidence } from "../core/loop/evidence.js";
import { formatElapsedTime, formatTimestamp } from "../utils/formatting/index.js";
import { HookRegistry } from "../hooks/registry.js";
import type { ToolExecuteHandlerContext } from "./context.js";

type ToolExecuteAfterHook = NonNullable<Hooks["tool.execute.after"]>;
export type ToolExecuteAfterInput = Parameters<ToolExecuteAfterHook>[0];
export type ToolExecuteAfterOutput = Parameters<ToolExecuteAfterHook>[1];

/**
 * Create tool.execute.after handler
 */
export function createToolExecuteAfterHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (
        toolInput: ToolExecuteAfterInput,
        toolOutput: ToolExecuteAfterOutput
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

        const toolArguments = readToolArgs(toolInput.args);
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

function readToolArgs(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
