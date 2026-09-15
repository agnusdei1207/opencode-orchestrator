/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 4-Agent consolidated architecture.
 * Handlers are modularized in src/plugin-handlers/ for maintainability.
 *
 * The agents are: Commander, Planner, Worker, Reviewer
 */

import type { Plugin } from "@opencode-ai/plugin";
import { registerAllTools } from "./tools/registry.js";
import { PLUGIN_HOOKS } from "./shared/index.js";
import { initializePluginRuntime } from "./plugin-runtime.js";

// Import modularized handlers
import { createToolExecuteBeforeHandler } from "./plugin-handlers/tool-execute-pre-handler.js";
import { createChatParamsHandler } from "./plugin-handlers/chat-params-handler.js";
import { createCommandExecuteBeforeHandler } from "./plugin-handlers/command-execute-handler.js";
import {
    createEventHandler,
    createConfigHandler,
    createChatMessageHandler,
    createToolExecuteAfterHandler,
    createSessionCompactingHandler,
    createSystemTransformHandler,
} from "./plugin-handlers/index.js";

// ============================================================================
// Plugin Definition
// ============================================================================

const OrchestratorPlugin: Plugin = async (input, options) => {
    const runtime = initializePluginRuntime(input, options);
    const { directory, handlerContext, asyncAgentTools, shutdownManager } = runtime;

    return {
        tool: registerAllTools(directory, asyncAgentTools),
        config: createConfigHandler(),
        event: createEventHandler(handlerContext),
        [PLUGIN_HOOKS.CHAT_MESSAGE]: createChatMessageHandler(handlerContext),
        "command.execute.before": createCommandExecuteBeforeHandler(handlerContext),
        [PLUGIN_HOOKS.CHAT_PARAMS]: createChatParamsHandler(),
        [PLUGIN_HOOKS.TOOL_EXECUTE_BEFORE]: createToolExecuteBeforeHandler(handlerContext),
        [PLUGIN_HOOKS.TOOL_EXECUTE_AFTER]: createToolExecuteAfterHandler(handlerContext),
        [PLUGIN_HOOKS.EXPERIMENTAL_SESSION_COMPACTING]: createSessionCompactingHandler(handlerContext),
        [PLUGIN_HOOKS.EXPERIMENTAL_CHAT_SYSTEM_TRANSFORM]: createSystemTransformHandler(handlerContext),
        dispose: () => shutdownManager.shutdown(),
    };
};

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only default export the plugin.
export default OrchestratorPlugin;
