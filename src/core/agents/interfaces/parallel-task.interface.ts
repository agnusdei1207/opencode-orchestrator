/**
 * ParallelTask Interface - Represents a task running in a parallel session
 */

import type { ParallelTaskStatus } from "../types/parallel-task-status.type.js";
import type { TaskProgress } from "./task-progress.interface.js";

export interface ParallelTask {
    id: string;
    sessionID: string;
    parentSessionID: string;
    description: string;
    prompt: string;
    agent: string;
    status: ParallelTaskStatus;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    result?: string;
    concurrencyKey?: string;

    // Depth tracking - prevents infinite recursion
    depth: number;

    // Stability detection
    lastMsgCount?: number;
    stablePolls?: number;

    // Progress tracking
    progress?: TaskProgress;
}
