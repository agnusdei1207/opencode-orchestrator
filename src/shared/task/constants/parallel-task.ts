/**
 * Parallel Task Configuration
 */

import { TIME } from "../../core/constants/time.js";

/**
 * Parallel task constants
 */
const PARALLEL_LABEL = "parallel";

export const PARALLEL_TASK = {
    // Task lifecycle (24 hours for long tasks)
    TTL_MS: 24 * TIME.HOUR,
    CLEANUP_DELAY_MS: 10 * TIME.MINUTE,
    MAX_DEPTH: 3,

    // Concurrency limits (safe for most APIs)
    DEFAULT_CONCURRENCY: 3,
    MAX_CONCURRENCY: 10,

    // Sync polling (for delegate_task sync mode)
    // Optimized: Reduced polling frequency while relying more on events
    SYNC_TIMEOUT_MS: 5 * TIME.MINUTE,
    POLL_INTERVAL_MS: 2000,           // 500 → 2000ms (75% less API calls)
    MIN_IDLE_TIME_MS: 3 * TIME.SECOND, // 5s → 3s (faster detection)
    MIN_STABILITY_MS: 2 * TIME.SECOND, // 3s → 2s (faster stability)
    STABLE_POLLS_REQUIRED: 2,          // 3 → 2 (faster completion)
    MAX_POLL_COUNT: 150,               // 600 → 150 (adjusted for 2s interval)

    // Session naming
    SESSION_TITLE_PREFIX: "Parallel",

    // Labels for output
    LABEL: PARALLEL_LABEL,
    GROUP_PREFIX: `${PARALLEL_LABEL}:`,
} as const;
