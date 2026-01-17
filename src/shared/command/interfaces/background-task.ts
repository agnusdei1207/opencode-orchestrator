/**
 * Background shell command task
 */
import type { ChildProcess } from "child_process";
import type { BackgroundTaskStatus } from "../types/index.js";

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
