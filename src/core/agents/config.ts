/**
 * Parallel Manager Configuration
 */

import { PARALLEL_TASK } from "../../shared/index.js";

export const CONFIG = {
    TASK_TTL_MS: PARALLEL_TASK.TTL_MS,
    CLEANUP_DELAY_MS: PARALLEL_TASK.CLEANUP_DELAY_MS,
    MIN_STABILITY_MS: PARALLEL_TASK.MIN_STABILITY_MS,
    POLL_INTERVAL_MS: PARALLEL_TASK.POLL_INTERVAL_MS,
} as const;
