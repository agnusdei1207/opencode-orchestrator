/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 4-Agent consolidated architecture.
 * Handlers are modularized in src/plugin-handlers/ for maintainability.
 *
 * The agents are: Commander, Planner, Worker, Reviewer
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version: PLUGIN_VERSION } = require("../package.json");

import type { Plugin } from "@opencode-ai/plugin";
import { state } from "./core/orchestrator/index.js";
import { callAgentTool } from "./tools/callAgent.js";
import { createSlashcommandTool } from "./tools/slashCommand.js";
import {
    grepSearchTool,
    globSearchTool,
    mgrepTool,
    sedReplaceTool,
    diffTool,
    jqTool,
    httpTool,
    fileStatsTool,
    gitDiffTool,
    gitStatusTool,
} from "./tools/search.js";
import {
    runBackgroundTool,
    checkBackgroundTool,
    listBackgroundTool,
    killBackgroundTool,
} from "./tools/background-cmd/index.js";
import { ParallelAgentManager } from "./core/agents/index.js";
import { createAsyncAgentTools } from "./tools/parallel/index.js";
import { astSearchTool, astReplaceTool } from "./tools/ast/index.js";
import { webfetchTool, websearchTool, cacheDocsTool, codesearchTool } from "./tools/web/index.js";
import { lspDiagnosticsTool } from "./tools/lsp/index.js";
import { TOOL_NAMES } from "./shared/index.js";
import * as Toast from "./core/notification/toast.js";
import { initializeHooks } from "./hooks/index.js"; // Initialize Hooks
import { PluginManager } from "./core/plugins/plugin-manager.js";

// Import modularized handlers
import { createToolExecuteBeforeHandler } from "./plugin-handlers/tool-execute-pre-handler.js"; // Added import
import {
    createEventHandler,
    createConfigHandler,
    createChatMessageHandler,
    createToolExecuteAfterHandler,
    createAssistantDoneHandler,
    createSessionCompactingHandler,
    createSystemTransformHandler,
    type SessionState,
} from "./plugin-handlers/index.js";

// ============================================================================
// Plugin Definition
// ============================================================================

const OrchestratorPlugin: Plugin = async (input) => {
    const { directory, client } = input;

    // Initialize Hooks System
    initializeHooks();

    // =========================================================================
    // Initialize Core Systems
    // =========================================================================

    // Initialize toast system with OpenCode client for TUI display
    Toast.initToastClient(client);

    // Initialize task toast manager for consolidated task notifications
    const taskToastManager = Toast.initTaskToastManager(client);

    // Track active sessions - using event-based continuation (no step limits)
    const sessions = new Map<string, SessionState>();

    // Initialize parallel agent manager
    const parallelAgentManager = ParallelAgentManager.getInstance(client, directory);
    const asyncAgentTools = createAsyncAgentTools(parallelAgentManager, client);

    // Initialize Plugin System
    const pluginManager = PluginManager.getInstance();
    await pluginManager.initialize(directory);
    const dynamicTools = pluginManager.getDynamicTools();

    // Connect task toast manager to concurrency controller for slot info
    taskToastManager.setConcurrencyController(parallelAgentManager.getConcurrency());

    // =========================================================================
    // Create Handler Contexts
    // =========================================================================

    const handlerContext = {
        client,
        directory,
        sessions,
        state,
    };

    // =========================================================================
    // Return Plugin Hooks
    // =========================================================================

    return {
        // -----------------------------------------------------------------
        // Tools we expose to the LLM
        // -----------------------------------------------------------------
        tool: {
            [TOOL_NAMES.CALL_AGENT]: callAgentTool,
            [TOOL_NAMES.SLASHCOMMAND]: createSlashcommandTool(),
            // Search & Replace tools
            [TOOL_NAMES.GREP_SEARCH]: grepSearchTool(directory),
            [TOOL_NAMES.GLOB_SEARCH]: globSearchTool(directory),
            [TOOL_NAMES.MGREP]: mgrepTool(directory),
            [TOOL_NAMES.SED_REPLACE]: sedReplaceTool(directory),
            // Diff & Compare tools
            [TOOL_NAMES.DIFF]: diffTool(),
            // JSON tools
            [TOOL_NAMES.JQ]: jqTool(),
            // HTTP tools
            [TOOL_NAMES.HTTP]: httpTool(),
            // File tools
            [TOOL_NAMES.FILE_STATS]: fileStatsTool(directory),
            // Git tools
            [TOOL_NAMES.GIT_DIFF]: gitDiffTool(directory),
            [TOOL_NAMES.GIT_STATUS]: gitStatusTool(directory),
            // Background task tools
            [TOOL_NAMES.RUN_BACKGROUND]: runBackgroundTool,
            [TOOL_NAMES.CHECK_BACKGROUND]: checkBackgroundTool,
            [TOOL_NAMES.LIST_BACKGROUND]: listBackgroundTool,
            [TOOL_NAMES.KILL_BACKGROUND]: killBackgroundTool,
            // Web tools
            [TOOL_NAMES.WEBFETCH]: webfetchTool,
            [TOOL_NAMES.WEBSEARCH]: websearchTool,
            [TOOL_NAMES.CACHE_DOCS]: cacheDocsTool,
            [TOOL_NAMES.CODESEARCH]: codesearchTool,
            // LSP tools
            [TOOL_NAMES.LSP_DIAGNOSTICS]: lspDiagnosticsTool(directory),
            // AST tools
            [TOOL_NAMES.AST_SEARCH]: astSearchTool(directory),
            [TOOL_NAMES.AST_REPLACE]: astReplaceTool(directory),
            // Async agent tools
            ...asyncAgentTools,
            // Dynamic tools from plugins
            ...dynamicTools,
        },

        // -----------------------------------------------------------------
        // Config hook - registers our commands and agents with OpenCode
        // -----------------------------------------------------------------
        config: createConfigHandler(),

        // -----------------------------------------------------------------
        // Event hook - handles OpenCode events
        // -----------------------------------------------------------------
        event: createEventHandler(handlerContext),

        // -----------------------------------------------------------------
        // chat.message hook - intercepts commands and sets up sessions
        // -----------------------------------------------------------------
        "chat.message": createChatMessageHandler(handlerContext),

        // -----------------------------------------------------------------
        // tool.execute.before hook - runs before any tool call
        // -----------------------------------------------------------------
        "tool.execute.before": createToolExecuteBeforeHandler(handlerContext),

        // -----------------------------------------------------------------
        // tool.execute.after hook - runs after any tool call completes
        // -----------------------------------------------------------------
        "tool.execute.after": createToolExecuteAfterHandler(handlerContext),

        // -----------------------------------------------------------------
        // assistant.done hook - runs when the LLM finishes responding
        // -----------------------------------------------------------------
        "assistant.done": createAssistantDoneHandler(handlerContext),

        // -----------------------------------------------------------------
        // experimental.session.compacting hook - preserves mission context during compaction
        // -----------------------------------------------------------------
        "experimental.session.compacting": createSessionCompactingHandler(handlerContext),

        // -----------------------------------------------------------------
        // experimental.chat.system.transform hook - dynamic system prompt injection
        // -----------------------------------------------------------------
        "experimental.chat.system.transform": createSystemTransformHandler(handlerContext),
    };
};

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only default export the plugin.
export default OrchestratorPlugin;
