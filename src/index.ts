/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 4-Agent consolidated architecture.
 * Handlers are modularized in src/plugin-handlers/ for maintainability.
 *
 * The agents are: Commander, Planner, Worker, Reviewer
 */

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
import { registerAllTools } from "./tools/registry.js";
import { SHUTDOWN_HANDLERS, SESSION_EVENTS, PLUGIN_HOOKS } from "./shared/index.js";
import { parseOrchestratorPluginOptions } from "./core/config/plugin-options.js";
import { configureMissionRuntimeOptions } from "./core/loop/mission-runtime-options.js";
import { shutdownCircuitBreaker } from "./core/loop/circuit-breaker.js";
import { shutdownCompactionGuard } from "./core/loop/compaction-guard.js";
import { shutdownSessionActivity } from "./core/session/activity.js";
import { shutdownPendingInjections } from "./core/session/pending-injection.js";
import { shutdownProgressTracker } from "./core/loop/progress-tracker.js";
import { shutdownTodoContinuation } from "./core/loop/todo-continuation.js";
import { shutdownMissionLoopHandler } from "./core/loop/mission-loop-handler.js";

// Import modularized handlers
import { createToolExecuteBeforeHandler } from "./plugin-handlers/tool-execute-pre-handler.js";
import {
    createEventHandler,
    createConfigHandler,
    createChatMessageHandler,
    createToolExecuteAfterHandler,
    createSessionCompactingHandler,
    createSystemTransformHandler,
} from "./plugin-handlers/index.js";
import type { PluginSessionState } from "./plugin-handlers/context.js";

// ============================================================================
// Plugin Definition
// ============================================================================

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(source: UnknownRecord, key: string): string | undefined {
    const value = source[key];
    return typeof value === "string" ? value : undefined;
}

function readCreatedSessionID(properties: unknown): string | undefined {
    if (!isRecord(properties)) return undefined;
    const directSessionID = readStringField(properties, "sessionID");
    if (directSessionID) return directSessionID;

    const info = properties.info;
    return isRecord(info) ? readStringField(info, "id") : undefined;
}

const OrchestratorPlugin: Plugin = async (input, options) => {
    const { directory, client } = input;
    const orchestratorOptions = parseOrchestratorPluginOptions(options);
    const concurrencyConfig = orchestratorOptions.concurrency;
    configureMissionRuntimeOptions(orchestratorOptions.missionLoop);

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
    const sessions = new Map<string, PluginSessionState>();

    // Initialize parallel agent manager
    const parallelAgentManager = ParallelAgentManager.getInstance(client, directory, concurrencyConfig);
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
    // Module-load prune timers + per-session state that would otherwise leak
    // on plugin dispose/hot-reload (both intervals .unref(), so low impact).
    shutdownManager.register(SHUTDOWN_HANDLERS.CIRCUIT_BREAKER, () => shutdownCircuitBreaker(), 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.COMPACTION_GUARD, () => shutdownCompactionGuard(), 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.SESSION_ACTIVITY, () => shutdownSessionActivity(), 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.PENDING_INJECTION, () => shutdownPendingInjections(), 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.PROGRESS_TRACKER, () => shutdownProgressTracker(), 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.TODO_CONTINUATION, () => shutdownTodoContinuation(), 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.MISSION_LOOP_HANDLER, () => shutdownMissionLoopHandler(), 45);

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
        event: async (payload) => {
            // Call the modular event handler
            const result = await createEventHandler(handlerContext)(payload);

            // Additional logic for Todo Sync
            const { event } = payload;
            if (event.type === SESSION_EVENTS.CREATED) {
                const sessionID = readCreatedSessionID(event.properties);
                if (sessionID) {
                    todoSync.registerSession(sessionID);
                }
            }

            return result;
        },

        // -----------------------------------------------------------------
        // chat.message hook - intercepts commands and sets up sessions
        // -----------------------------------------------------------------
        [PLUGIN_HOOKS.CHAT_MESSAGE]: createChatMessageHandler(handlerContext),

        // -----------------------------------------------------------------
        // tool.execute.before hook - runs before any tool call
        // -----------------------------------------------------------------
        [PLUGIN_HOOKS.TOOL_EXECUTE_BEFORE]: createToolExecuteBeforeHandler(handlerContext),

        // -----------------------------------------------------------------
        // tool.execute.after hook - runs after any tool call completes
        // -----------------------------------------------------------------
        [PLUGIN_HOOKS.TOOL_EXECUTE_AFTER]: createToolExecuteAfterHandler(handlerContext),

        // -----------------------------------------------------------------
        // experimental.session.compacting hook - preserves mission context during compaction
        // -----------------------------------------------------------------
        [PLUGIN_HOOKS.EXPERIMENTAL_SESSION_COMPACTING]: createSessionCompactingHandler(handlerContext),

        // -----------------------------------------------------------------
        // experimental.chat.system.transform hook - dynamic system prompt injection
        // -----------------------------------------------------------------
        [PLUGIN_HOOKS.EXPERIMENTAL_CHAT_SYSTEM_TRANSFORM]: createSystemTransformHandler(handlerContext),

        // -----------------------------------------------------------------
        // dispose hook - cleanup resources on plugin unload
        // -----------------------------------------------------------------
        dispose: async () => {
            await shutdownManager.shutdown();
        },
    };
};

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only default export the plugin.
export default OrchestratorPlugin;
