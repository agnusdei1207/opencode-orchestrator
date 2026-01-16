/**
 * ParallelTask - Represents a task running in a parallel session
 */
import { ParallelTaskStatus } from "../types/parallel-task-status.js";

export interface TaskProgress {
    toolCalls: number;
    lastTool?: string;
    lastMessage?: string;
    lastUpdate: Date;
}

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

    // Stability detection
    lastMsgCount?: number;
    stablePolls?: number;

    // Progress tracking
    progress?: TaskProgress;
}

