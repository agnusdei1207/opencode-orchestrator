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


