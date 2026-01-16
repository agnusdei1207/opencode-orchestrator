/**
 * Parallel Task Types
 */

export type ParallelTaskStatus = "pending" | "running" | "completed" | "error" | "timeout";

export interface ParallelTask {
    id: string;
    sessionID: string;
    parentSessionID: string;
    description: string;
    agent: string;
    status: ParallelTaskStatus;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    result?: string;
    concurrencyKey?: string;
}

export interface LaunchInput {
    description: string;
    prompt: string;
    agent: string;
    parentSessionID: string;
}
