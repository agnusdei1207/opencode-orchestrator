/**
 * Core constants (consolidated)
 */
import { TOOL_NAMES } from "../tool/tool-names.js";

/**
 * Time Constants
 */

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
} as const;

/**
 * Memory Limits
 */


export const MEMORY_LIMITS = {
    MAX_TASKS_IN_MEMORY: 1000,
    MAX_NOTIFICATIONS_PER_PARENT: 100,
    ARCHIVE_AGE_MS: 30 * TIME.MINUTE,
    ERROR_CLEANUP_AGE_MS: 10 * TIME.MINUTE,
} as const;

/**
 * CLI Tool Names
 */

export const CLI_NAME = {
    SH: "sh",
} as const;


/**
 * ID Prefixes
 * 
 * Format: PREFIX + number (e.g., ses_1, SYNC-42, UT-100)
 * No fixed digit limit - use any positive integer.
 */

export const ID_PREFIX = {
    TASK: "task_",
    JOB: "job_",
} as const;



/**
 * File Paths
 */

export const PATHS = {
    OPENCODE: ".opencode",
    DOCS: ".opencode/docs",
    TASK_ARCHIVE: ".opencode/archive/tasks",
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

export const LIMITS = {
    /**
     * Mission loop iteration ceiling shown in prompts and toasts. Deliberately
     * unreachable: loops end on verification, the circuit breaker, stagnation
     * escalation or the user, not on a count.
     */
    MAX_ITERATIONS: 1_000_000_000,
    /** Default history/list limit for UI */
    DEFAULT_LIST_LIMIT: 20,
    /** Default progress bar width */
    DEFAULT_PROGRESS_WIDTH: 20,
} as const;

/**
 * Unified Status Labels
 * 
 * Primitive string values for all status indicators across the system.
 * Casing is standardized to lowercase for consistent internal communication.
 */

export const STATUS_LABEL = {
    // Basic States
    PENDING: "pending",
    QUEUED: "queued",
    RUNNING: "running",
    IN_PROGRESS: "in_progress",

    COMPLETED: "completed",
    DONE: "done",
    SUCCESS: "success",

    // Failure States
    FAILED: "failed",
    ERROR: "error",
    TIMEOUT: "timeout",
    CANCELLED: "cancelled",
    BLOCKED: "blocked",

    // Test/Audit Results
    PASS: "pass",
    FAIL: "fail",
    SKIP: "skip",

    // Quality/Cleanliness
    CLEAN: "clean",
    OK: "ok",
    VERIFIED: "verified",


    // Analysis/Diagnostic
    WARNING: "warning",
    INFO: "info",
    HINT: "hint",
    ALL: "all",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
} as const;

export type TaskStatus = typeof STATUS_LABEL[keyof typeof STATUS_LABEL];

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
    /** CleanupScheduler - Manages periodic cleanup tasks */
    CLEANUP_SCHEDULER: "CleanupScheduler",

    /** RustToolPool - Manages Rust tool instances */
    RUST_TOOL_POOL: "RustToolPool",

    /** BackgroundTaskManager - Manages background command execution */
    BACKGROUND_TASK_MANAGER: "BackgroundTaskManager",

    /** ParallelAgentManager - Manages parallel agent task execution */
    PARALLEL_AGENT_MANAGER: "ParallelAgentManager",

    /** CircuitBreaker - Prune timer + per-session breaker state */
    CIRCUIT_BREAKER: "CircuitBreaker",

    /** CompactionGuard - Prune timer + per-session compaction state */
    COMPACTION_GUARD: "CompactionGuard",

    /** SessionActivity - Prune timer + per-session busy/idle state */
    SESSION_ACTIVITY: "SessionActivity",

    /** PendingInjection - Prune timer + per-session deferred prompt queues */
    PENDING_INJECTION: "PendingInjection",

    /** ProgressTracker - Prune timer + per-session progress snapshots */
    PROGRESS_TRACKER: "ProgressTracker",

    /** MissionLoopHandler - Session-state store prune timer */
    MISSION_LOOP_HANDLER: "MissionLoopHandler",
} as const;

export const MEMORY_CONSTANTS = {
    ID_PREFIX: "mem_",
    IMPORTANCE: {
        LOW: 0.3,
        NORMAL: 0.5,
        HIGH: 0.7,
        CRITICAL: 0.9,
    },
    // Tools that produce high volume or irrelevant output for memory
    NOISY_TOOLS: [
        TOOL_NAMES.LIST_TASKS,
        TOOL_NAMES.GET_TASK_RESULT,
        TOOL_NAMES.LIST_BACKGROUND,
        TOOL_NAMES.CHECK_BACKGROUND,
        TOOL_NAMES.LIST_AGENTS,
        TOOL_NAMES.SHOW_METRICS
    ] as string[],
    // Significant keywords for memory promotion
    KEYWORDS: {
        DONE: "DONE",
        SUCCESS: "SUCCESS",
        ERROR: "ERROR",
        FAIL: "FAIL",
    },
    MAX_CONTENT_LENGTH: 1000,
} as const;

export const HOOK_NAMES = {
    MEMORY_GATE: "MemoryGate",
    METRICS_TELEMETRY: "MetricsTelemetry",
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
