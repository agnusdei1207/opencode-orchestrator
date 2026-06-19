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
    MAX_EVENT_HISTORY: 100,
    MAX_TOAST_HISTORY: 50,
    MAX_PROGRESS_HISTORY_PER_SESSION: 100,
    ARCHIVE_AGE_MS: 30 * TIME.MINUTE,
    ERROR_CLEANUP_AGE_MS: 10 * TIME.MINUTE,
} as const;

/**
 * CLI Tool Names
 */

export const CLI_NAME = {
    NPX: "npx",
    TSC: "tsc",
    ESLINT: "eslint",
    RG: "rg",
    SED: "sed",
    AST_GREP: "ast-grep",
    GIT: "git",
    JQ: "jq",
    NODE: "node",
    SH: "sh",
} as const;

/**
 * Node Process Events
 */
export const PROC_EVENT = {
    CLOSE: "close",
    ERROR: "error",
    EXIT: "exit",
    DATA: "data",
    MESSAGE: "message",
    DISCONNECT: "disconnect",
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
    SESSION: "ses_",
    SYNC_ISSUE: "SYNC-",
    UNIT_TEST: "UT-",
    WORKER: "wrk_",
} as const;



/**
 * File Paths
 */

export const PATHS = {
    OPENCODE: ".opencode",
    DOCS: ".opencode/docs",
    ARCHIVE: ".opencode/archive",
    TASK_ARCHIVE: ".opencode/archive/tasks",
    DOC_ARCHIVE: ".opencode/archive/docs",
    TODO: ".opencode/todo.md",
    CONTEXT: ".opencode/context.md",
    SUMMARY: ".opencode/summary.md",
    DOC_METADATA: ".opencode/docs/_metadata.json",
    // TDD & Parallel Work State
    WORK_LOG: ".opencode/work-log.md",
    UNIT_TESTS: ".opencode/unit-tests",
    SYNC_ISSUES: ".opencode/sync-issues.md",
    INTEGRATION_STATUS: ".opencode/integration-status.md",
    // Progress tracking
    STATUS: ".opencode/status.md",
    // Configuration
    AGENTS_CONFIG: ".opencode/agents.json",
    PLUGINS: ".opencode/plugins",
} as const;


/**
 * Mission Phase Constants
 */

export const PHASES = {
    PHASE_0: {
        ID: "PHASE_0",
        NAME: "DISCOVERY",
        DESCRIPTION: "Parallel intelligence gathering and project mapping",
        MANDATORY: true,
    },
    PHASE_1: {
        ID: "PHASE_1",
        NAME: "THINK",
        DESCRIPTION: "Analyze scope, decomposition, and delegation",
        MANDATORY: true,
    },
    PHASE_2: {
        ID: "PHASE_2",
        NAME: "TRIAGE",
        DESCRIPTION: "Complexity assessment and execution path selection",
        MANDATORY: true,
    },
    PHASE_3: {
        ID: "PHASE_3",
        NAME: "PLAN",
        DESCRIPTION: "Architectural roadmap and task grid creation",
        MANDATORY: true,
    },
    PHASE_4: {
        ID: "PHASE_4",
        NAME: "EXECUTE",
        DESCRIPTION: "HPFA grid execution and worker coordination",
        MANDATORY: true,
    },
    PHASE_5: {
        ID: "PHASE_5",
        NAME: "VERIFY",
        DESCRIPTION: "MSVP final gate and E2E system validation",
        MANDATORY: true,
    },
    PHASE_6: {
        ID: "PHASE_6",
        NAME: "CONCLUDE",
        DESCRIPTION: "Mission completion and deterministic output",
        MANDATORY: true,
    },
} as const;

/**
 * System Limits
 */

export const LIMITS = {
    /** Maximum mission loop iterations */
    MAX_ITERATIONS: 1_000_000_000,
    /** Default scan limit for file listing */
    DEFAULT_SCAN_LIMIT: 20,
    /** Max message history to check for conclusion */

    CONCLUDE_CHECK_HISTORY: 3,
    /** Max concurrent tasks per agent */
    MAX_TASKS_PER_AGENT: 10,
    /** Default history/list limit for UI */
    DEFAULT_LIST_LIMIT: 20,
    /** Default progress bar width */
    DEFAULT_PROGRESS_WIDTH: 20,
    /** Maximum time for atomic task (minutes) */
    TASK_TIME_LIMIT_MIN: 10,
} as const;

/**
 * WAL (Write-Ahead Log) Action constants
 */

export const WAL_ACTIONS = {
    LAUNCH: "LAUNCH",
    UPDATE: "UPDATE",
    COMPLETE: "COMPLETE",
    DELETE: "DELETE",
} as const;

export type WALAction = typeof WAL_ACTIONS[keyof typeof WAL_ACTIONS];

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


export const MEMORY_CONSTANTS = {
    ID_PREFIX: "mem_",
    LEVELS: {
        SYSTEM: "system",
        PROJECT: "project",
        MISSION: "mission",
        TASK: "task",
    },
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
    MISSION_CONTROL: "MissionControl",
    STRICT_ROLE_GUARD: "StrictRoleGuard",
    SECRET_SCANNER: "SecretScanner",
    AGENT_UI: "AgentUI",
    RESOURCE_CONTROL: "ResourceControl",
    USER_ACTIVITY: "UserActivity",
    SLASH_COMMAND: "SlashCommandDispatcher",
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
    PREFIX: {
        TASK: "task-",
        FILE: "file-task-",
    }
} as const;

export const TUI_CONSTANTS = {
    BAR_WIDTH: 30,
    COLORS: {
        PROGRESS: "\x1b[36m",
        AGENT: "\x1b[32m",
        RESET: "\x1b[0m",
        BOLD: "\x1b[1m",
        DIM: "\x1b[2m",
    },
    LABELS: {
        IDLE: "Idle",
        WAITING: "Waiting for tasks...",
        PROGRESS_TITLE: "MISSION PROGRESS",
        AGENT_TITLE: "ACTIVE AGENTS",
    }
} as const;

