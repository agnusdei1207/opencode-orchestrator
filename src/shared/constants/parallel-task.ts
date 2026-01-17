/**
 * Parallel Task Configuration
 */

import { TIME } from "./time.js";

export const PARALLEL_TASK = {
    TTL_MS: 60 * TIME.MINUTE,
    CLEANUP_DELAY_MS: 10 * TIME.MINUTE,
    MIN_STABILITY_MS: 3 * TIME.SECOND,
    POLL_INTERVAL_MS: 1000,
    DEFAULT_CONCURRENCY: 3,
    MAX_CONCURRENCY: 50,
    SYNC_TIMEOUT_MS: 10 * TIME.MINUTE,
    MAX_DEPTH: 3,
} as const;
