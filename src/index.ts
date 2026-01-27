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
import { ParallelAgentManager } from "./core/agents/index.js";
import { createAsyncAgentTools } from "./tools/parallel/index.js";
import * as Toast from "./core/notification/toast.js";
import { initializeHooks } from "./hooks/index.js"; // Initialize Hooks
import { PluginManager } from "./core/plugins/plugin-manager.js";
import { TodoSyncService } from "./core/sync/todo-sync-service.js";
import { CleanupScheduler } from "./core/cleanup/cleanup-scheduler.js";
import { ShutdownManager } from "./shared/lifecycle/index.js";
import { backgroundTaskManager } from "./core/commands/manager.js";
import { shutdownRustToolPool } from "./tools/rust-pool.js";
import { registerAllTools } from "./tools/registry.js"; // Phase 2-C: Unified tool registry
import { SHUTDOWN_HANDLERS } from "./shared/index.js";

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

    // Initialize Todo Sync Service (Phase 1 Improvement)
    const todoSync = new TodoSyncService(client, directory);
    await todoSync.start();
    taskToastManager.setTodoSync(todoSync);

    // Initialize Cleanup Scheduler (Phase 1 Improvement)
    const cleanupScheduler = new CleanupScheduler(directory);
    cleanupScheduler.start();

    // Initialize Shutdown Manager (Phase 6 - Resource Safety)
    const shutdownManager = new ShutdownManager();
    shutdownManager.register(SHUTDOWN_HANDLERS.TODO_SYNC_SERVICE, () => todoSync.stop(), 10);
    shutdownManager.register(SHUTDOWN_HANDLERS.CLEANUP_SCHEDULER, () => cleanupScheduler.stop(), 10);
    shutdownManager.register(SHUTDOWN_HANDLERS.RUST_TOOL_POOL, async () => await shutdownRustToolPool(), 15);
    shutdownManager.register(SHUTDOWN_HANDLERS.BACKGROUND_TASK_MANAGER, async () => await backgroundTaskManager.shutdown(), 20);
    shutdownManager.register(SHUTDOWN_HANDLERS.PARALLEL_AGENT_MANAGER, async () => {
        // Release all sessions
        await parallelAgentManager.shutdown().catch(() => {});
    }, 30);
    shutdownManager.register(SHUTDOWN_HANDLERS.PLUGIN_MANAGER, async () => {
        await pluginManager.shutdown().catch(() => {});
    }, 40);

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
        // Tools we expose to the LLM (Phase 2-C: Unified Registry)
        // -----------------------------------------------------------------
        tool: registerAllTools(directory, asyncAgentTools, dynamicTools),

        // -----------------------------------------------------------------
        // Config hook - registers our commands and agents with OpenCode
        // -----------------------------------------------------------------
        config: createConfigHandler(),

        // -----------------------------------------------------------------
        // Event hook - handles OpenCode events
        // -----------------------------------------------------------------
        // -----------------------------------------------------------------
        // Event hook - handles OpenCode events
        // -----------------------------------------------------------------
        event: async (payload) => {
            // Call the modular event handler
            const result = await createEventHandler(handlerContext)(payload);

            // Additional logic for Todo Sync
            const { event } = payload;
            if (event.type === "session.created" && event.properties) {
                const sessionID = (event.properties as any).sessionID || (event.properties as any).id || (event.properties as any).info?.sessionID;
                if (sessionID) {
                    todoSync.registerSession(sessionID);
                }
            }

            return result;
        },

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

        // -----------------------------------------------------------------
        // shutdown hook - cleanup resources on plugin unload
        // -----------------------------------------------------------------
        shutdown: async () => {
            await shutdownManager.shutdown();
        },
    };
};

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only default export the plugin.
export default OrchestratorPlugin;
