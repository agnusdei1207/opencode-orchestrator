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
    sessionID?: string;
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
    sessionID?: string;
}
declare class BackgroundTaskManager {
    private static _instance;
    private tasks;
    private debugMode;
    private storageDir;
    private storageFile;
    private monitoringInterval?;
    private constructor();
    static get instance(): BackgroundTaskManager;
    /**
     * Generate a unique task ID in the format job_xxxxxxxx
     */
    private generateId;
    /**
     * Ensure storage directory exists
     */
    private ensureStorageDir;
    /**
     * Load tasks from disk on startup
     */
    private loadFromDisk;
    /**
     * Save tasks to disk
     */
    private saveToDisk;
    /**
     * Start periodic monitoring of running processes
     */
    private startMonitoring;
    /**
     * Stop monitoring
     */
    private stopMonitoring;
    /**
     * Monitor running processes and detect zombie processes
     */
    private monitorRunningProcesses;
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
     * Clean up tasks by session ID
     */
    cleanupBySession(sessionID: string): number;
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
