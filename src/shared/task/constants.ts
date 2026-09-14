/**
 * Task constants (consolidated)
 */
import { TIME } from "../core/constants.js";

/**
 * Background Task Status
 */

export const BACKGROUND_STATUS = {
    RUNNING: "running",
    DONE: "done",
    ERROR: "error",
    TIMEOUT: "timeout",
} as const;

export type BackgroundStatus = (typeof BACKGROUND_STATUS)[keyof typeof BACKGROUND_STATUS];

/**
 * Background Task Configuration
 */


export const BACKGROUND_TASK = {
    DEFAULT_TIMEOUT_MS: 5 * TIME.MINUTE,
    MAX_OUTPUT_LENGTH: 10000,
    MAX_CONCURRENT: 5,
    POLL_INTERVAL_MS: 500,
    RETRY_COOLDOWN_MS: 30 * TIME.SECOND,
} as const;

/**
 * Task Metadata Keys
 */

export const TASK_METADATA = {
    PARALLEL: "parallel",
    PARALLEL_GROUP: "parallel_group",
    DEPENDS: "depends",
    AGENT: "agent",
    SIZE: "size",
} as const;

/**
 * Parallel Task Configuration
 */


/**
 * Parallel task constants
 */
const PARALLEL_LABEL = "parallel";

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
    DEFAULT_CONCURRENCY: 10,
    MAX_CONCURRENCY: 50,

    // Bounded wait for manager-owned completion in delegate_task sync mode.
    SYNC_TIMEOUT_MS: 5 * TIME.MINUTE,
    POLL_INTERVAL_MS: 2 * TIME.SECOND,
    MIN_STABILITY_MS: 2 * TIME.SECOND,

    // Session naming
    SESSION_TITLE_PREFIX: "Parallel",

    // Labels for output
    LABEL: PARALLEL_LABEL,
    GROUP_PREFIX: `${PARALLEL_LABEL}:`,
} as const;
