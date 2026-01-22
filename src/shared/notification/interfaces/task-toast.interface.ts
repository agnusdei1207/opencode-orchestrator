import { TaskStatus } from "../../core/index.js";

export interface TrackedTask {
    id: string;
    description: string;
    agent: string;
    status: TaskStatus;
    startedAt: Date;
    isBackground: boolean;
    parentSessionID?: string;
    sessionID?: string;
}

export interface TaskCompletionInfo {
    id: string;
    description: string;
    duration: string;
    status: TaskStatus;
    error?: string;
}
