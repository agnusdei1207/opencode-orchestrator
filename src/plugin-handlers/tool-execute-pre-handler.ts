/**
 * Pre-Tool Execute Handler
 * 
 * Handles tool.execute.before hook.
 * Used for blocking prohibited actions based on agent roles via Hooks.
 */

import { HookRegistry } from "../hooks/registry.js";
import type { ToolExecuteHandlerContext } from "./context.js";
import { log } from "../core/agents/logger.js";
import { HOOK_ACTIONS } from "../hooks/constants.js";
import { isRecord } from "../shared/core/guards.js";

export interface ToolExecuteBeforeInput {
    sessionID: string;
    tool: string;
    callID: string;
}

export interface ToolExecuteBeforeOutput {
    args: Record<string, unknown>;
}

export function createToolExecuteBeforeHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (
        toolInput: ToolExecuteBeforeInput,
        toolOutput: ToolExecuteBeforeOutput,
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return;
        const toolArguments = readToolArgs(toolOutput.args);

        const result = await hooks.executePreTool(
            {
                sessionID: toolInput.sessionID,
                callID: toolInput.callID,
                agent: session.agent,
                directory,
                sessions,
            },
            toolInput.tool,
            toolArguments
        );

        if (result.action === HOOK_ACTIONS.BLOCK) {
            log(`[PreToolHandler] Blocked tool ${toolInput.tool} in session ${toolInput.sessionID}: ${result.reason}`);
            // Throwing error captures the block in most agent runtimes
            throw new Error(`🚫 Action Blocked: ${result.reason || "Policy violation"}`);
        }
    };
}

function readToolArgs(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

