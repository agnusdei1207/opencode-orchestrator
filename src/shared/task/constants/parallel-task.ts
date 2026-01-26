/**
 * Parallel Task Configuration
 */

import { TIME } from "../../core/constants/time.js";

/**
 * Parallel task constants
 */
const PARALLEL_LABEL = "parallel";

export const TASK_MODE = {
    NORMAL: "normal",
    RACE: "race",       // Speculative execution: First to finish wins
    FRACTAL: "fractal", // Recursive execution: Task can spawn sub-missions
} as const;

export const PARALLEL_TASK = {
    // Task lifecycle (24 hours for long tasks)
    TTL_MS: 24 * TIME.HOUR,
    CLEANUP_DELAY_MS: 10 * TIME.MINUTE,

    /**
     * Maximum recursion depth for parallel task spawning
     * 
     * Depth hierarchy:
     * - Depth 0: Commander (can spawn Planner/Worker/Reviewer)
     * - Depth 1: Planner (can spawn Worker)
     * - Depth 2: Worker/Reviewer (TERMINAL - cannot spawn sub-agents)
     * - Depth 3: BLOCKED
     * 
     * This prevents infinite recursion and ensures the Reviewer
     * doesn't wait indefinitely for deeply nested sub-tasks.
     */
    MAX_DEPTH: 3,

    /**
     * Terminal node depth - agents at this depth cannot spawn sub-agents.
     * Worker and Reviewer are terminal nodes by design.
     */
    TERMINAL_DEPTH: 2,

    // Concurrency limits (Aggressive for intense processing)
    DEFAULT_CONCURRENCY: 3,  // Reduced from 10
    MAX_CONCURRENCY: 5,      // Reduced from 50

    // Sync polling (for delegate_task sync mode)
    // Optimized: Reduced polling frequency while relying more on events
    SYNC_TIMEOUT_MS: 5 * TIME.MINUTE,
    POLL_INTERVAL_MS: 5000,          // 2000ms → 5000ms (To reduce load)
    MIN_IDLE_TIME_MS: 5 * TIME.SECOND, // 3s → 5s (Less jittery)
    MIN_STABILITY_MS: 5 * TIME.SECOND, // 2s → 5s (More stable)
    STABLE_POLLS_REQUIRED: 2,          // 3 → 2 (Faster completion)
    MAX_POLL_COUNT: 150,               // 600 → 150 (Adjusted for 2s interval)

    // Session naming
    SESSION_TITLE_PREFIX: "Parallel",

    // Labels for output
    LABEL: PARALLEL_LABEL,
    GROUP_PREFIX: `${PARALLEL_LABEL}:`,
} as const;
