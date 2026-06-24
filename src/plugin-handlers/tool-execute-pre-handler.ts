/**
 * Pre-Tool Execute Handler
 * 
 * Handles tool.execute.before hook.
 * Used for blocking prohibited actions based on agent roles via Hooks.
 */

import type { Hooks } from "@opencode-ai/plugin";
import { HookRegistry } from "../hooks/registry.js";
import type { ToolExecuteHandlerContext } from "./context.js";
import { log } from "../core/agents/logger.js";
import { HOOK_ACTIONS } from "../hooks/constants.js";

type ToolExecuteBeforeHook = NonNullable<Hooks["tool.execute.before"]>;
export type ToolExecuteBeforeInput = Parameters<ToolExecuteBeforeHook>[0];
export type ToolExecuteBeforeOutput = Parameters<ToolExecuteBeforeHook>[1];

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

        if (result.action === HOOK_ACTIONS.MODIFY && result.modifiedArgs) {
            replaceToolArguments(toolOutput, result.modifiedArgs);
        }
    };
}

function replaceToolArguments(
    toolOutput: ToolExecuteBeforeOutput,
    modifiedArgs: Record<string, unknown>,
): void {
    toolOutput.args = { ...modifiedArgs };
}

function readToolArgs(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
