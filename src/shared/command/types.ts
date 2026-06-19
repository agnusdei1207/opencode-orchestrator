/**
 * Command types and interfaces
 */
import type { ChildProcess } from "child_process";

export type BackgroundTaskStatus = "pending" | "running" | "done" | "error" | "timeout";

/**
 * Options for running a background command
 */
export interface RunBackgroundOptions {
    command: string;
    cwd?: string;
    timeout?: number;
    label?: string;
}

/**
 * Background shell command task
 */
export interface BackgroundTask {
    id: string;
    command: string;
    args: string[];
    cwd: string;
    label?: string;
    status: BackgroundTaskStatus;
    output: string;
    errorOutput: string;
    exitCode: number | null;
    startTime: number;
    endTime?: number;
    timeout: number;
    process?: ChildProcess;
}
