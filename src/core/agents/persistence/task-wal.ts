/**
 * Task WAL (Write-Ahead Log) - REMOVED
 * 
 * This module is deprecated and provides no-op stubs for backward compatibility.
 * WAL was removed to reduce I/O overhead and simplify architecture.
 */

import type { ParallelTask } from "../interfaces/index.js";

export interface WALEntry {
    timestamp: string;
    action: string;
    taskId: string;
    data: Partial<ParallelTask>;
}

/**
 * No-op WAL - all methods are stubs
 */
export class TaskWAL {
    async init(): Promise<void> { }
    async log(): Promise<void> { }
    async flush(): Promise<void> { }
    async readAll(): Promise<Map<string, ParallelTask>> { return new Map(); }
    async compact(): Promise<void> { }
}

export const taskWAL = new TaskWAL();
