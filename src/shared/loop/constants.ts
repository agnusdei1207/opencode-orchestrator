/**
 * Loop constants (consolidated)
 */
import { TIME, LIMITS, STATUS_LABEL } from "../core/constants.js";

/**
 * Loop Continuation Configuration
 */


export const LOOP = {
    /** Countdown seconds before auto-continuation */
    COUNTDOWN_SECONDS: 3,
    /** Minimum time between continuation checks */
    MIN_TIME_BETWEEN_CHECKS_MS: 3 * TIME.SECOND,
    /** Grace period after countdown starts (ignore messages) */
    COUNTDOWN_GRACE_PERIOD_MS: 500,
    /** Window to consider abort as recent */
    ABORT_WINDOW_MS: 3 * TIME.SECOND,
    /** Maximum iterations for mission loop */
    DEFAULT_MAX_ITERATIONS: LIMITS.MAX_ITERATIONS,

    /** Rust tool timeout */
    RUST_TOOL_TIMEOUT_MS: 60 * TIME.SECOND,
} as const;

/**
 * Mission Control Configuration
 */


export const MISSION_CONTROL = {
    DEFAULT_MAX_ITERATIONS: LIMITS.MAX_ITERATIONS,
    DEFAULT_COUNTDOWN_SECONDS: 3,
    STATE_FILE: "loop-state.json",
    STOP_COMMAND: "/stop",
    CANCEL_COMMAND: "/cancel",
    LOG_SOURCE: "mission-loop",
} as const;


export const TASK_STATUS = {
    PENDING: STATUS_LABEL.PENDING,
    RUNNING: STATUS_LABEL.RUNNING,
    COMPLETED: STATUS_LABEL.COMPLETED,
    FAILED: STATUS_LABEL.FAILED,
    ERROR: STATUS_LABEL.ERROR,
    TIMEOUT: STATUS_LABEL.TIMEOUT,
    CANCELLED: STATUS_LABEL.CANCELLED,
} as const;

/**
 * Todo Status Constants
 */


export const TODO_STATUS = {
    PENDING: STATUS_LABEL.PENDING,
    IN_PROGRESS: STATUS_LABEL.IN_PROGRESS,
    COMPLETED: STATUS_LABEL.COMPLETED,
    CANCELLED: STATUS_LABEL.CANCELLED,
} as const;

/**
 * Status and Progress Labels for UI and Logging
 */

export const LOOP_LABELS = {
    // Progress
    PROGRESS_PREFIX: "[TODO Progress]:",
    INCOMPLETE_TASKS: "Incomplete Tasks",
    NEXT_TASK: "Next Task",

    // Status Indicators
    STATUS_TITLE: "Status",
    STATUS: {
        RUNNING: "[RUN]",
        WAITING: "[WAIT]",
    },

    // Priority Indicators
    PRIORITY: {
        HIGH: "[H]",
        MEDIUM: "[M]",
        LOW: "[L]",
    },

    // Parallel Dispatch
    PARALLEL_REQUIRED: "[PARALLEL DISPATCH REQUIRED]",
    EXECUTE_NOW: "// EXECUTE NOW - Launch all $COUNT tasks simultaneously:",
    PARALLEL_NOTICE: "NOTICE: Do NOT run these sequentially. Use background=true for ALL.",
    MONITOR_PROGRESS: "After launching, use list_tasks to monitor progress.",

    // Action Required
    ACTION_REQUIRED: "**Action Required**:",
    ACTION_CONTINUE: "1. Continue working on incomplete todos",
    ACTION_MARK_COMPLETE: "2. Mark each task complete when finished",
    ACTION_DONT_STOP: "3. Do NOT stop until all todos are completed or cancelled",

    // Completion
    VERIFIED_COMPLETE: "[Verified Complete]",
    FINAL_STATUS: "**Final Status**:",
    TOTAL_TASKS: "Total Tasks",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    SUCCESS_RATE: "Success Rate",
    MISSION_ACCOMPLISHED: "All tasks have been processed and verified. Mission accomplished!",
} as const;
