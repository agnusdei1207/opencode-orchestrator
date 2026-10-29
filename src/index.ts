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
import { setupV2 } from "./v2/setup.js";
import { parseOrchestratorPluginOptions } from "./core/config/plugin-options.js";

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
    createMissionMessagesHandler,
    createTextCompleteHandler,
    createMessagesGuardHandler,
} from "./plugin-handlers/index.js";

// ============================================================================
// Plugin Definition
// ============================================================================

const OrchestratorServerPlugin: Plugin = async (input, options) => {
    const pluginOptions = parseOrchestratorPluginOptions(options);
    const runtime = initializePluginRuntime(input, options);
    const { directory, handlerContext, asyncAgentTools, shutdownManager } = runtime;
    const missionMessages = createMissionMessagesHandler(handlerContext);
    const messageGuard = createMessagesGuardHandler();
    let tools: ReturnType<typeof registerAllTools>;
    try {
        tools = registerAllTools(directory, asyncAgentTools);
    } catch (error) {
        // The host never receives `dispose` for a plugin that failed to load.
        await shutdownManager.shutdown();
        throw error;
    }

    return {
        tool: tools,
        config: createConfigHandler(),
        event: createEventHandler(handlerContext),
        [PLUGIN_HOOKS.CHAT_MESSAGE]: createChatMessageHandler(handlerContext),
        "command.execute.before": createCommandExecuteBeforeHandler(handlerContext),
        [PLUGIN_HOOKS.CHAT_PARAMS]: createChatParamsHandler(handlerContext.contextLimits, pluginOptions.agentTemperatures),
        [PLUGIN_HOOKS.TOOL_EXECUTE_BEFORE]: createToolExecuteBeforeHandler(handlerContext),
        [PLUGIN_HOOKS.TOOL_EXECUTE_AFTER]: createToolExecuteAfterHandler(handlerContext, pluginOptions.customRendering),
        [PLUGIN_HOOKS.EXPERIMENTAL_SESSION_COMPACTING]: createSessionCompactingHandler(handlerContext),
        [PLUGIN_HOOKS.EXPERIMENTAL_TEXT_COMPLETE]: createTextCompleteHandler(pluginOptions.customRendering),
        [PLUGIN_HOOKS.EXPERIMENTAL_CHAT_MESSAGES_TRANSFORM]: async (input, output) => {
            await missionMessages(input, output);
            await messageGuard(input, output);
        },
        dispose: () => shutdownManager.shutdown(),
    };
};

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only default export the plugin.
const OrchestratorPlugin = {
    id: "opencode-orchestrator",
    server: OrchestratorServerPlugin,
    setup: setupV2,
};

export default OrchestratorPlugin;
