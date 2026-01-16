/**
 * Centralized Constants
 */

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
} as const;

export const PARALLEL_TASK = {
    TTL_MS: 30 * TIME.MINUTE,
    CLEANUP_DELAY_MS: 5 * TIME.MINUTE,
    MIN_STABILITY_MS: 5 * TIME.SECOND,
    POLL_INTERVAL_MS: 2000,
    DEFAULT_CONCURRENCY: 3,
} as const;

export const ID_PREFIX = {
    AGENT_TASK: "agent_",
    CMD_JOB: "job_",
} as const;
