
/**
 * Pre-Tool Execute Handler
 * 
 * Handles tool.execute.before hook.
 * Used for blocking prohibited actions based on agent roles via Hooks.
 */

import { HookRegistry } from "../hooks/registry.js";
import type { ToolExecuteHandlerContext, ToolHookInput } from "./interfaces/index.js";
import { log } from "../core/agents/logger.js";
import { HOOK_ACTIONS } from "../hooks/constants.js";

export function createToolExecuteBeforeHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (
        toolInput: ToolHookInput
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return; // or proceed? If not active, maybe we don't care, or we default allow.

        // Execute Pre-Tool Hooks
        const result = await hooks.executePreTool(
            {
                sessionID: toolInput.sessionID,
                directory,
                sessions: sessions as Map<string, any>,
                // In future, try to resolve 'agent' from session state if possible
            },
            toolInput.tool,
            toolInput.arguments || {}
        );

        if (result.action === HOOK_ACTIONS.BLOCK) {
            log(`[PreToolHandler] Blocked tool ${toolInput.tool} in session ${toolInput.sessionID}: ${result.reason}`);
            // Throwing error captures the block in most agent runtimes
            throw new Error(`🚫 Action Blocked: ${result.reason || "Policy violation"}`);
        }

        if (result.action === HOOK_ACTIONS.MODIFY && result.modifiedArgs) {
            // Mutate arguments in place if the framework allows reference mutation.
            // Usually input.arguments is a reference to the actual object being passed to the tool.
            if (!toolInput.arguments) toolInput.arguments = {};
            Object.assign(toolInput.arguments, result.modifiedArgs);
        }
    };
}
