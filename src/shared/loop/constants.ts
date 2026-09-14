/**
 * Loop constants (consolidated)
 */
import { TIME, LIMITS, STATUS_LABEL } from "../core/constants.js";

/**
 * Loop Continuation Configuration
 */


export const LOOP = {
    /** Minimum time between continuation checks */
    MIN_TIME_BETWEEN_CHECKS_MS: 3 * TIME.SECOND,
    /** Maximum iterations for mission loop */
    DEFAULT_MAX_ITERATIONS: LIMITS.MAX_ITERATIONS,

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
    STATUS_TITLE: "Status",
} as const;
