/**
 * Core constants (consolidated)
 */
/**
 * Time Constants
 */

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
} as const;

/**
 * File Paths
 */

export const PATHS = {
    OPENCODE: ".opencode",
    DOCS: ".opencode/docs",
    TODO: ".opencode/todo.md",
    CONTEXT: ".opencode/context.md",
    SYNC_ISSUES: ".opencode/sync-issues.md",
    // Progress tracking
    STATUS: ".opencode/status.md",
    // Configuration
    AGENTS_CONFIG: ".opencode/agents.json",
} as const;

/**
 * System Limits
 */

/**
 * Logging Constants
 *
 * Centralized log prefixes used throughout the application to ensure
 * consistent formatting and easier log filtering.
 */

export const LOG_PREFIX = {
    RUST_POOL: "RustPool",

    /** Lifecycle management */
    SHUTDOWN_MANAGER: "ShutdownManager",

} as const;

/**
 * Lifecycle & Shutdown Handler Constants
 *
 * Centralized constant definitions for all shutdown handler names used
 * throughout the application to ensure consistency and maintainability.
 */

export const SHUTDOWN_HANDLERS = {
    /** Per-instance record of native subagent child sessions */
    CHILD_SESSIONS: "ChildSessions",

    /** Process-wide services shared by every plugin instance; released by the last one */
    PROCESS_SERVICES: "ProcessServices",

    /** CircuitBreaker - Prune timer + per-session breaker state */
    CIRCUIT_BREAKER: "CircuitBreaker",

    /** SessionActivity - Prune timer + per-session activity state */
    SESSION_ACTIVITY: "SessionActivity",

    /** PendingInjection - Prune timer + queued prompts */
    PENDING_INJECTION: "PendingInjection",

    /** ProgressTracker - Prune timer + per-session progress state */
    PROGRESS_TRACKER: "ProgressTracker",

    /** MissionLoopHandler - Session-state store prune timer and countdowns */
    MISSION_LOOP_HANDLER: "MissionLoopHandler",
} as const;

export const HOOK_NAMES = {
    SANITY_CHECK: "SanityCheck",
    MISSION_LOOP: "MissionLoop",
    STRICT_ROLE_GUARD: "StrictRoleGuard",
    SECRET_SCANNER: "SecretScanner",
    RESOURCE_CONTROL: "ResourceControl",
} as const;

export const TODO_CONSTANTS = {
    MARKERS: {
        PENDING: "[ ]",
        COMPLETED: "[x]",
        PROGRESS: "[/]",
        FAILED: "[-]",
    },
    STATUS: {
        PENDING: "pending",
        COMPLETED: "completed",
        PROGRESS: "progress",
        FAILED: "failed",
    },
} as const;
