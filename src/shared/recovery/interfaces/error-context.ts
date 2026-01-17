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
