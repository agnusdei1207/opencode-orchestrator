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

    // Concurrency limits (FIXED at 5 for stability - no auto-scaling)
    CONCURRENCY: 5,          // Fixed concurrency (removed DEFAULT/MAX split)

    // Legacy support (deprecated - use CONCURRENCY instead)
    DEFAULT_CONCURRENCY: 5,
    MAX_CONCURRENCY: 5,

    // Sync polling (for delegate_task sync mode)
    // Optimized: 3s polling for faster response while maintaining stability
    SYNC_TIMEOUT_MS: 30 * TIME.MINUTE,  // 5min → 30min (longer tasks)
    POLL_INTERVAL_MS: 3000,              // 5000ms → 3000ms (faster polling)
    MIN_IDLE_TIME_MS: 3 * TIME.SECOND,   // 5s → 3s (quicker detection)
    MIN_STABILITY_MS: 3 * TIME.SECOND,   // 5s → 3s (faster completion)
    STABLE_POLLS_REQUIRED: 2,            // Keep at 2 for reliability
    MAX_POLL_COUNT: 600,                 // 150 → 600 (30min = 600 * 3s)

    // Session naming
    SESSION_TITLE_PREFIX: "Parallel",

    // Labels for output
    LABEL: PARALLEL_LABEL,
    GROUP_PREFIX: `${PARALLEL_LABEL}:`,
} as const;
