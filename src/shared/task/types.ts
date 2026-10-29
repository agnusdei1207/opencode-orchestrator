/**
 * Task types and interfaces (consolidated)
 */
/**
 * Parallel task status values
 */
export type ParallelTaskStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "error"
    | "timeout"
    | "cancelled";

/**
 * Input for launching a parallel task
 */
export interface LaunchInput {
    description: string;
    prompt: string;
    agent: string;
    parentSessionID: string;
    /** Current nesting depth (default: 1) */
    depth?: number;
}

/**
 * Input for resuming an existing parallel task session
 * 
 * Preserves context for:
 * - Retry after failure
 * - Follow-up questions
 * - Token efficiency
 */
export interface ResumeInput {
    /** Session ID to resume */
    sessionId: string;
    /** New prompt for resumed session */
    prompt: string;
    /** Parent session for notifications */
    parentSessionID: string;
}

/**
 * Parallel task running in child session
 * MERGED: Contains both core and shared fields
 */

export interface ParallelTask {
    // Core identity
    id: string;
    sessionID: string;
    parentSessionID: string;
    description: string;
    prompt: string;
    agent: string;

    // Status
    status: ParallelTaskStatus;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    result?: string;
    concurrencyKey?: string;

    // Depth tracking - prevents infinite recursion
    depth: number;
}
