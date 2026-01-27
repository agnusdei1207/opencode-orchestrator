/**
 * BackgroundTask - Represents a shell command running in background
 */
import { ChildProcess } from "child_process";
import { BackgroundTaskStatus } from "../types/background-task-status.js";

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
    timeoutHandle?: NodeJS.Timeout;
}
