/**
 * Task types and interfaces (consolidated)
 */
import type { Poolable } from "../core/index.js";

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
 * Task progress tracking
 */
export interface TaskProgress {
    toolCalls: number;
    lastTool?: string;
    lastMessage?: string;
    lastUpdate: Date;
}

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
    mode?: "normal" | "race" | "fractal";
    groupID?: string;
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

export interface ParallelTask extends Poolable {
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

    // HPFA (Hyper-Parallel Fractal Architecture) fields
    mode?: "normal" | "race" | "fractal";
    groupID?: string; // Used for racing groups or recursive families

    // Stability detection
    lastMsgCount?: number;
    stablePolls?: number;

    // Progress tracking
    progress?: TaskProgress;

    // Output tracking for optimization
    hasStartedOutputting?: boolean;
}
