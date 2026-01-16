/**
 * Auto Recovery Interfaces & Types
 */

/**
 * Recovery action types
 */
export type RecoveryAction =
    | { type: "retry"; delay: number; attempt: number }
    | { type: "skip"; reason: string }
    | { type: "escalate"; to: string; reason: string }
    | { type: "resume"; sessionId: string }
    | { type: "compact"; reason: string }
    | { type: "abort"; reason: string };

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
 * Error pattern definition
 */
export interface ErrorPattern {
    pattern: RegExp | string;
    category: string;
    handler: (context: ErrorContext) => RecoveryAction;
}

/**
 * Recovery history entry
 */
export interface RecoveryRecord {
    context: ErrorContext;
    action: RecoveryAction;
    timestamp: Date;
}

/**
 * Recovery statistics
 */
export interface RecoveryStats {
    totalRecoveries: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
    successRate: number;
}
