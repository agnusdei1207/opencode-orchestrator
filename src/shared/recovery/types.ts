/**
 * Recovery types (consolidated)
 */

/**
 * Recovery action type
 */
export type RecoveryAction = "retry" | "abort" | "escalate" | "ignore";

/**
 * Error context for recovery
 */
export interface ErrorContext {
    sessionId: string;
    taskId?: string;
    agent?: string;
    error: Error;
    attempt: number;
    timestamp: Date;
}

/**
 * Recovery history record
 */

export interface RecoveryRecord {
    context: ErrorContext;
    action: RecoveryAction;
    timestamp: Date;
}

