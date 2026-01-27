/**
 * Parallel task running in child session
 * MERGED: Contains both core and shared fields
 */
import type { ParallelTaskStatus } from "../types/index.js";
import type { TaskProgress } from "./task-progress.js";
import type { Poolable } from "../../core/index.js";

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
