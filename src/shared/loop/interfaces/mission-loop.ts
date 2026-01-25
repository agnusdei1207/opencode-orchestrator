/**
 * Mission Loop Interfaces
 */

export interface MissionLoopState {
    /** Whether loop is active */
    active: boolean;
    /** Current iteration number */
    iteration: number;
    /** Maximum allowed iterations */
    maxIterations: number;
    /** Original task prompt */
    prompt: string;
    /** Session ID */
    sessionID: string;
    /** When loop started */
    startedAt: string;
    /** Last activity timestamp */
    lastActivity?: string;
    /** Last known progress string (e.g., "3/10") */
    lastProgress?: string;
    /** Number of iterations without progress */
    stagnationCount?: number;
}

export interface MissionLoopOptions {
    /** Maximum iterations before stopping (default: 1000) */
    maxIterations?: number;
    /** Countdown seconds before auto-continue (default: 3) */
    countdownSeconds?: number;
}
