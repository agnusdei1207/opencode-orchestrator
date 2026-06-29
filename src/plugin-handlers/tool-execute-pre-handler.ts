
/**
 * Pre-Tool Execute Handler
 * 
 * Handles tool.execute.before hook.
 * Used for blocking prohibited actions based on agent roles via Hooks.
 */

import { HookRegistry } from "../hooks/registry.js";
import type {
    ToolArgs,
    ToolBeforeHookOutput,
    ToolExecuteHandlerContext,
    ToolHookBaseInput,
} from "./interfaces/index.js";
import { log } from "../core/agents/logger.js";
import { HOOK_ACTIONS } from "../hooks/constants.js";

export function createToolExecuteBeforeHandler(ctx: ToolExecuteHandlerContext) {
    const { sessions, directory } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (
        toolInput: ToolHookBaseInput,
        toolOutput: ToolBeforeHookOutput,
    ) => {
        const session = sessions.get(toolInput.sessionID);
        if (!session?.active) return;
        const args = readToolArgs(toolOutput);

        const result = await hooks.executePreTool(
            {
                sessionID: toolInput.sessionID,
                directory,
                sessions,
            },
            toolInput.tool,
            args
        );

        if (result.action === HOOK_ACTIONS.BLOCK) {
            log(`[PreToolHandler] Blocked tool ${toolInput.tool} in session ${toolInput.sessionID}: ${result.reason}`);
            throw new Error(`🚫 Action Blocked: ${result.reason || "Policy violation"}`);
        }

        if (result.action === HOOK_ACTIONS.MODIFY && result.modifiedArgs) {
            Object.assign(args, result.modifiedArgs);
            toolOutput.args = args;
        }
    };
}

function readToolArgs(output: ToolBeforeHookOutput): ToolArgs {
    if (typeof output.args === "object" && output.args !== null && !Array.isArray(output.args)) {
        return output.args;
    }

    output.args = {};
    return output.args;
}
