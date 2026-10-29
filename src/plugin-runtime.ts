import type { HostClient } from "./host/client.js";
import { initializeHooks } from "./hooks/index.js";
import { ShutdownManager } from "./shared/lifecycle/index.js";
import { SHUTDOWN_HANDLERS } from "./shared/index.js";
import { parseOrchestratorOptions, type OrchestratorOptions } from "./core/config/options.js";
import { configureMissionRuntimeOptions } from "./core/loop/mission-runtime-options.js";
import { shutdownCircuitBreaker } from "./core/loop/circuit-breaker.js";
import { shutdownSessionActivity } from "./core/session/activity.js";
import { shutdownPendingInjections } from "./core/session/pending-injection.js";
import { shutdownProgressTracker } from "./core/loop/progress-tracker.js";
import { shutdownMissionLoopHandler } from "./core/loop/mission-loop-handler.js";
import { ContextLimitResolver } from "./core/context/context-limit-resolver.js";
import { ChildSessions } from "./core/session/child-sessions.js";
import type { PluginHandlerContext, PluginSessionState } from "./plugin-handlers/context.js";

export interface RuntimeInput {
    client: HostClient;
    directory: string;
}

export interface PluginRuntime {
    directory: string;
    options: OrchestratorOptions;
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
// Budget for registerProcessShutdownHandlers: five handlers at the default 5s each.
const PROCESS_SHUTDOWN_TIMEOUT_MS = 5 * 5_000;

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
    shutdownManager.register(SHUTDOWN_HANDLERS.CIRCUIT_BREAKER, shutdownCircuitBreaker, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.SESSION_ACTIVITY, shutdownSessionActivity, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.PENDING_INJECTION, shutdownPendingInjections, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.PROGRESS_TRACKER, shutdownProgressTracker, 45);
    shutdownManager.register(SHUTDOWN_HANDLERS.MISSION_LOOP_HANDLER, shutdownMissionLoopHandler, 45);
}

function createShutdownManager(children: ChildSessions, releaseProcessServices: () => Promise<void>): ShutdownManager {
    const shutdownManager = new ShutdownManager();
    shutdownManager.register(SHUTDOWN_HANDLERS.CHILD_SESSIONS, () => children.clear(), 30);
    shutdownManager.register(SHUTDOWN_HANDLERS.PROCESS_SERVICES, releaseProcessServices, 40, PROCESS_SHUTDOWN_TIMEOUT_MS);
    return shutdownManager;
}

export function initializePluginRuntime(input: RuntimeInput, rawOptions: unknown): PluginRuntime {
    const options = parseOrchestratorOptions(rawOptions);
    configureMissionRuntimeOptions(options.missionLoop, input.directory);
    const contextLimits = new ContextLimitResolver({
        lookup: (providerID, modelID) => input.client.modelContextLimit(providerID, modelID),
        overrideMaxTokens: options.contextMaxTokens,
    });
    initializeHooks();
    const children = new ChildSessions();
    return {
        directory: input.directory,
        options,
        handlerContext: {
            client: input.client,
            directory: input.directory,
            sessions: new Map<string, PluginSessionState>(),
            children,
            contextLimits,
        },
        shutdownManager: createShutdownManager(children, acquireProcessServices()),
    };
}
