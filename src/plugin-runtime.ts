import type { PluginInput, PluginOptions, ToolDefinition } from "@opencode-ai/plugin";
import { state } from "./core/orchestrator/index.js";
import { ParallelAgentManager } from "./core/agents/index.js";
import { createAsyncAgentTools } from "./tools/parallel/index.js";
import * as Toast from "./core/notification/toast.js";
import { initializeHooks } from "./hooks/index.js";
import { CleanupScheduler } from "./core/cleanup/cleanup-scheduler.js";
import { ShutdownManager } from "./shared/lifecycle/index.js";
import { backgroundTaskManager } from "./core/commands/manager.js";
import { shutdownRustToolPool } from "./tools/rust-pool.js";
import { SHUTDOWN_HANDLERS } from "./shared/index.js";
import { parseOrchestratorPluginOptions } from "./core/config/plugin-options.js";
import { configureMissionRuntimeOptions } from "./core/loop/mission-runtime-options.js";
import { shutdownCircuitBreaker } from "./core/loop/circuit-breaker.js";
import { shutdownCompactionGuard } from "./core/loop/compaction-guard.js";
import { shutdownSessionActivity } from "./core/session/activity.js";
import { shutdownPendingInjections } from "./core/session/pending-injection.js";
import { shutdownProgressTracker } from "./core/loop/progress-tracker.js";
import { shutdownMissionLoopHandler } from "./core/loop/mission-loop-handler.js";
import { ContextLimitResolver } from "./core/context/context-limit-resolver.js";
import type { PluginHandlerContext, PluginSessionState } from "./plugin-handlers/context.js";

export interface PluginRuntime {
    directory: string;
    asyncAgentTools: Record<string, ToolDefinition>;
    handlerContext: PluginHandlerContext;
    shutdownManager: ShutdownManager;
}

function registerProcessShutdownHandlers(shutdownManager: ShutdownManager): void {
    shutdownManager.register(SHUTDOWN_HANDLERS.RUST_TOOL_POOL, shutdownRustToolPool, 15);
    shutdownManager.register(SHUTDOWN_HANDLERS.BACKGROUND_TASK_MANAGER, () => backgroundTaskManager.shutdown(), 20);
    shutdownManager.register(SHUTDOWN_HANDLERS.CIRCUIT_BREAKER, shutdownCircuitBreaker, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.COMPACTION_GUARD, shutdownCompactionGuard, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.SESSION_ACTIVITY, shutdownSessionActivity, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.PENDING_INJECTION, shutdownPendingInjections, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.PROGRESS_TRACKER, shutdownProgressTracker, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.MISSION_LOOP_HANDLER, shutdownMissionLoopHandler, 45);
}

function createShutdownManager(
    cleanupScheduler: CleanupScheduler,
    parallelAgentManager: ParallelAgentManager,
): ShutdownManager {
    const shutdownManager = new ShutdownManager();
    shutdownManager.register(SHUTDOWN_HANDLERS.CLEANUP_SCHEDULER, () => cleanupScheduler.stop(), 10);
    shutdownManager.register(
        SHUTDOWN_HANDLERS.PARALLEL_AGENT_MANAGER,
        () => parallelAgentManager.shutdown().catch(() => {}),
        30,
    );
    registerProcessShutdownHandlers(shutdownManager);
    return shutdownManager;
}

function configureRuntime(input: PluginInput, options?: PluginOptions) {
    const orchestratorOptions = parseOrchestratorPluginOptions(options);
    configureMissionRuntimeOptions(orchestratorOptions.missionLoop);
    ContextLimitResolver.getInstance().configure({
        client: input.client,
        overrideMaxTokens: orchestratorOptions.contextMaxTokens,
    });
    initializeHooks();
    Toast.initToastClient(input.client);
    return orchestratorOptions;
}

export function initializePluginRuntime(
    input: PluginInput,
    options?: PluginOptions,
): PluginRuntime {
    const optionsConfig = configureRuntime(input, options);
    const taskToastManager = Toast.initTaskToastManager(input.client);
    const parallelAgentManager = ParallelAgentManager.getInstance(
        input.client,
        input.directory,
        optionsConfig.concurrency,
    );
    taskToastManager.setConcurrencyController(parallelAgentManager.getConcurrency());

    const cleanupScheduler = new CleanupScheduler(input.directory);
    cleanupScheduler.start();
    const sessions = new Map<string, PluginSessionState>();
    return {
        directory: input.directory,
        asyncAgentTools: createAsyncAgentTools(parallelAgentManager),
        handlerContext: { client: input.client, directory: input.directory, sessions, state },
        shutdownManager: createShutdownManager(cleanupScheduler, parallelAgentManager),
    };
}
