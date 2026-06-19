/**
 * Loop types and interfaces (consolidated)
 */

/**
 * Todo status values
 */
export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

/**
 * Todo priority values
 */
export type TodoPriority = "high" | "medium" | "low";

/**
 * Todo statistics
 */
export interface TodoStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    percentComplete: number;
}

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
    /** Compact objective title shown in continuation prompts */
    objective?: string;
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
    /** Last verification summary observed before continuation */
    lastVerificationSummary?: string;
    /** Last reason the loop decided to continue */
    lastContinuationReason?: string;
    /** Last continuation timestamp */
    lastContinuationAt?: string;
}

export interface MissionLoopOptions {
    /** Maximum iterations before stopping (default: 1,000,000,000) */
    maxIterations?: number;
    /** Countdown seconds before auto-continue (default: 3) */
    countdownSeconds?: number;
}

/**
 * Todo item
 */

export interface Todo {
    id: string;
    content: string;
    status: TodoStatus;
    priority: TodoPriority;
    parentId?: string;
    createdAt: Date;
    completedAt?: Date;
}

