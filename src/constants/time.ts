/**
 * Time-related constants
 * Centralized to prevent duplication across the codebase
 */

// ============================================================================
// Task Timeouts
// ============================================================================

/** Maximum time a task can run before timeout (30 minutes) */
export const TASK_TTL_MS = 30 * 60 * 1000;

/** Default background task timeout (5 minutes) */
export const BACKGROUND_TASK_TIMEOUT_MS = 5 * 60 * 1000;

/** Maximum sync task poll time (10 minutes) */
export const SYNC_TASK_MAX_POLL_MS = 10 * 60 * 1000;

// ============================================================================
// Polling Intervals
// ============================================================================

/** Poll interval for parallel agent tasks (2 seconds) */
export const PARALLEL_POLL_INTERVAL_MS = 2000;

/** Poll interval for background task monitoring (5 seconds) */
export const BACKGROUND_MONITOR_INTERVAL_MS = 5000;

/** Poll interval for sync task completion (500ms) */
export const SYNC_POLL_INTERVAL_MS = 500;

// ============================================================================
// Stability & Cleanup Delays
// ============================================================================

/** Minimum time task must run before considered stable (5 seconds) */
export const MIN_STABILITY_MS = 5 * 1000;

/** Number of stable polls required to confirm completion (for sync mode) */
export const STABILITY_POLLS_REQUIRED = 3;

/** Delay before cleaning up completed tasks (5 minutes) */
export const CLEANUP_DELAY_MS = 5 * 60 * 1000;

/** Delay before retry after failure (500ms) */
export const RETRY_DELAY_MS = 500;

// ============================================================================
// Concurrency
// ============================================================================

/** Default maximum parallel tasks per agent type */
export const DEFAULT_CONCURRENCY = 3;

/** Maximum parallel tasks per agent type (hard limit) */
export const MAX_CONCURRENCY = 10;

// ============================================================================
// Session Limits
// ============================================================================

/** Default maximum steps for auto-continuation */
export const DEFAULT_MAX_STEPS = 500;

/** Maximum steps for /task command */
export const TASK_COMMAND_MAX_STEPS = 1000;

/** Maximum task retry attempts */
export const MAX_TASK_RETRIES = 3;
