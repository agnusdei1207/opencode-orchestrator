/**
 * System Limits
 */

export const LIMITS = {
    /** Maximum mission loop iterations */
    MAX_ITERATIONS: 10000,
    /** Default scan limit for file listing */
    DEFAULT_SCAN_LIMIT: 20,
    /** Max message history to check for seal */

    SEAL_CHECK_HISTORY: 3,
    /** Max concurrent tasks per agent */
    MAX_TASKS_PER_AGENT: 10,
    /** Default history/list limit for UI */
    DEFAULT_LIST_LIMIT: 20,
    /** Default progress bar width */
    DEFAULT_PROGRESS_WIDTH: 20,
    /** Maximum time for atomic task (minutes) */
    TASK_TIME_LIMIT_MIN: 10,
} as const;

