/**
 * Base Task Interface
 *
 * Common fields for all task types.
 */

import type { Poolable } from "../core/index.js";

/**
 * Base task interface with common fields
 */
export interface BaseTask {
    /** Unique task identifier */
    id: string;

    /** Human-readable description */
    description: string;

    /** Task status */
    status: string;

    /** Start timestamp */
    startedAt: Date;

    /** Completion timestamp (if completed) */
    completedAt?: Date;

    /** Error message (if failed) */
    error?: string;
}

/**
 * Pooled task interface
 * Combines base task with poolable behavior
 */
export interface PooledTask extends BaseTask, Poolable {
    /** Reset task to initial state */
    reset(): void;
}
