/**
 * Logging Constants
 *
 * Centralized log prefixes used throughout the application to ensure
 * consistent formatting and easier log filtering.
 */

export const LOG_PREFIX = {
    /** Rust Tool pool operations */
    RUST_TOOL: "RustTool",
    RUST_POOL: "RustPool",

    /** LSP diagnostics caching */
    DIAGNOSTICS_CACHE: "DiagnosticsCache",

    /** Context window monitoring */
    CONTEXT_WINDOW_MONITOR: "context-window-monitor",

    /** Memory management */
    MEMORY_MANAGER: "MemoryManager",

    /** Plugin system */
    PLUGIN_MANAGER: "PluginManager",

    /** OS notifications */
    SESSION_NOTIFY: "session-notify",

    /** Session recovery */
    SESSION_RECOVERY: "session-recovery",

    /** Lifecycle management */
    SHUTDOWN_MANAGER: "ShutdownManager",

    /** Agent registry */
    AGENT_REGISTRY: "AgentRegistry",

    /** Task synchronization */
    TODO_SYNC: "TodoSync",

    /** Cleanup scheduler */
    CLEANUP_SCHEDULER: "CleanupScheduler",

    /** Background task management */
    BACKGROUND_TASK_MANAGER: "BackgroundTaskManager",

    /** Parallel agent management */
    PARALLEL_AGENT_MANAGER: "ParallelAgentManager",

    /** File watching */
    FILE_WATCHER: "FileWatcher",
} as const;

/** Type for log prefixes */
export type LogPrefix = typeof LOG_PREFIX[keyof typeof LOG_PREFIX];
