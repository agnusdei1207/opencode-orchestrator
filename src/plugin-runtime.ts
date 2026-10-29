import type { PluginInput, PluginOptions, ToolDefinition } from "@opencode-ai/plugin";
import { state } from "./core/orchestrator/index.js";
import { ParallelAgentManager } from "./core/agents/index.js";
import { createAsyncAgentTools } from "./tools/parallel/index.js";
import * as Toast from "./core/notification/toast.js";
import { initializeHooks } from "./hooks/index.js";
import { CleanupScheduler } from "./core/cleanup/cleanup-scheduler.js";
import { ShutdownManager } from "./shared/lifecycle/index.js";
import { BACKGROUND_SHUTDOWN_TIMEOUT_MS, backgroundTaskManager } from "./core/commands/manager.js";
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

/**
 * OpenCode serves several directories from one process and loads a separate
 * plugin instance for each, disposing an instance when its directory goes idle.
 * Module-level services are shared by every instance, so they may only be torn
 * down when the last live instance is disposed.
 */
let liveInstances = 0;
// Budget for registerProcessShutdownHandlers: the background task manager has
// its own timeout and the other seven handlers use the default 5s each.
const DEFAULT_BUDGET_PROCESS_HANDLERS = 7;
const PROCESS_SHUTDOWN_TIMEOUT_MS = BACKGROUND_SHUTDOWN_TIMEOUT_MS + DEFAULT_BUDGET_PROCESS_HANDLERS * 5_000;

function acquireProcessServices(): () => Promise<void> {
    liveInstances++;
    let released = false;
    return async () => {
        if (released) return;
        released = true;
        liveInstances--;
        if (liveInstances > 0) return;
        const processShutdown = new ShutdownManager();
        registerProcessShutdownHandlers(processShutdown);
        await processShutdown.shutdown();
    };
}

function registerProcessShutdownHandlers(shutdownManager: ShutdownManager): void {
    shutdownManager.register(SHUTDOWN_HANDLERS.RUST_TOOL_POOL, shutdownRustToolPool, 15);
    shutdownManager.register(
        SHUTDOWN_HANDLERS.BACKGROUND_TASK_MANAGER,
        () => backgroundTaskManager.shutdown(),
        20,
        BACKGROUND_SHUTDOWN_TIMEOUT_MS,
    );
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
    releaseProcessServices: () => Promise<void>,
): ShutdownManager {
    const shutdownManager = new ShutdownManager();
    shutdownManager.register(SHUTDOWN_HANDLERS.CLEANUP_SCHEDULER, () => cleanupScheduler.stop(), 10);
    shutdownManager.register(
        SHUTDOWN_HANDLERS.PARALLEL_AGENT_MANAGER,
        () => parallelAgentManager.shutdown().catch(() => {}),
        30,
    );
    shutdownManager.register(
        SHUTDOWN_HANDLERS.PROCESS_SERVICES,
        releaseProcessServices,
        40,
        PROCESS_SHUTDOWN_TIMEOUT_MS,
    );
    return shutdownManager;
}

function configureRuntime(input: PluginInput, options?: PluginOptions) {
    const orchestratorOptions = parseOrchestratorPluginOptions(options);
    configureMissionRuntimeOptions(orchestratorOptions.missionLoop, input.directory);
    const contextLimits = new ContextLimitResolver();
    contextLimits.configure({
        client: input.client,
        overrideMaxTokens: orchestratorOptions.contextMaxTokens,
    });
    initializeHooks();
    const detachToastClient = Toast.initToastClient(input.client);
    return { orchestratorOptions, contextLimits, detachToastClient };
}

export function initializePluginRuntime(
    input: PluginInput,
    options?: PluginOptions,
): PluginRuntime {
    const { orchestratorOptions: optionsConfig, contextLimits, detachToastClient } = configureRuntime(input, options);
    const releaseProcessServices = acquireProcessServices();
    let parallelAgentManager: ParallelAgentManager | undefined;
    let cleanupScheduler: CleanupScheduler;
    try {
        parallelAgentManager = new ParallelAgentManager(
            input.client,
            input.directory,
            optionsConfig.concurrency,
        );
        cleanupScheduler = new CleanupScheduler(input.directory);
        cleanupScheduler.start();
    } catch (error) {
        // Nothing owns this instance yet, so release what it already holds.
        detachToastClient();
        void parallelAgentManager?.shutdown().catch(() => {});
        void releaseProcessServices().catch(() => {});
        throw error;
    }
    const sessions = new Map<string, PluginSessionState>();
    return {
        directory: input.directory,
        asyncAgentTools: createAsyncAgentTools(parallelAgentManager),
        handlerContext: {
            client: input.client,
            directory: input.directory,
            sessions,
            state,
            agents: parallelAgentManager,
            contextLimits,
        },
        shutdownManager: createShutdownManager(cleanupScheduler, parallelAgentManager, () => {
            detachToastClient();
            return releaseProcessServices();
        }),
    };
}
