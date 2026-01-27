/**
 * Lifecycle & Shutdown Handler Constants
 *
 * Centralized constant definitions for all shutdown handler names used
 * throughout the application to ensure consistency and maintainability.
 */

export const SHUTDOWN_HANDLERS = {
    /** TodoSyncService - Syncs TODO state via file watching */
    TODO_SYNC_SERVICE: "TodoSyncService",

    /** CleanupScheduler - Manages periodic cleanup tasks */
    CLEANUP_SCHEDULER: "CleanupScheduler",

    /** RustToolPool - Manages Rust tool instances */
    RUST_TOOL_POOL: "RustToolPool",

    /** BackgroundTaskManager - Manages background command execution */
    BACKGROUND_TASK_MANAGER: "BackgroundTaskManager",

    /** ParallelAgentManager - Manages parallel agent task execution */
    PARALLEL_AGENT_MANAGER: "ParallelAgentManager",

    /** PluginManager - Manages dynamic plugin lifecycle */
    PLUGIN_MANAGER: "PluginManager",
} as const;

/** Type for shutdown handler names */
export type ShutdownHandlerName = typeof SHUTDOWN_HANDLERS[keyof typeof SHUTDOWN_HANDLERS];
