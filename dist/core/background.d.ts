/**
 * Background Task Manager for OpenCode Orchestrator
 *
 * Enables running commands in the background and checking their status later.
 * This allows the AI to continue working while long-running tasks execute.
 */
import { ChildProcess } from "child_process";
export type TaskStatus = "pending" | "running" | "done" | "error" | "timeout";
export interface BackgroundTask {
    id: string;
    command: string;
    args: string[];
    cwd: string;
    label?: string;
    status: TaskStatus;
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
declare class BackgroundTaskManager {
    private static _instance;
    private tasks;
    private debugMode;
    private constructor();
    static get instance(): BackgroundTaskManager;
    /**
     * Generate a unique task ID in the format bg_xxxxxxxx
     */
    private generateId;
    /**
     * Debug logging helper
     */
    private debug;
    /**
     * Run a command in the background
     */
    run(options: RunBackgroundOptions): BackgroundTask;
    /**
     * Get task by ID
     */
    get(taskId: string): BackgroundTask | undefined;
    /**
     * Get all tasks
     */
    getAll(): BackgroundTask[];
    /**
     * Get tasks by status
     */
    getByStatus(status: TaskStatus): BackgroundTask[];
    /**
     * Clear completed/failed tasks
     */
    clearCompleted(): number;
    /**
     * Kill a running task
     */
    kill(taskId: string): boolean;
    /**
     * Format duration for display
     */
    formatDuration(task: BackgroundTask): string;
    /**
     * Get status emoji
     */
    getStatusEmoji(status: TaskStatus): string;
}
export declare const backgroundTaskManager: BackgroundTaskManager;
export {};
