/**
 * Background Task Types
 */

import { ChildProcess } from "child_process";

export type BackgroundTaskStatus = "pending" | "running" | "done" | "error" | "timeout";

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

export interface RunBackgroundOptions {
    command: string;
    cwd?: string;
    timeout?: number;
    label?: string;
}
