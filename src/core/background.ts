/**
 * Background Task Manager for OpenCode Orchestrator
 * 
 * Enables running commands in the background and checking their status later.
 * This allows the AI to continue working while long-running tasks execute.
 */

import { spawn, ChildProcess } from "child_process";
import { randomBytes } from "crypto";
import { ID_PREFIX } from "../shared/constants.js";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// BackgroundTaskManager Singleton
// ============================================================================

class BackgroundTaskManager {
    private static _instance: BackgroundTaskManager;
    private tasks: Map<string, BackgroundTask> = new Map();
    private debugMode: boolean = true; // Enable debug mode

    private constructor() { }

    static get instance(): BackgroundTaskManager {
        if (!BackgroundTaskManager._instance) {
            BackgroundTaskManager._instance = new BackgroundTaskManager();
        }
        return BackgroundTaskManager._instance;
    }

    /**
     * Generate a unique task ID
     */
    private generateId(): string {
        const hex = randomBytes(4).toString("hex");
        return `${ID_PREFIX.JOB}${hex}`;
    }

    /**
     * Debug logging helper
     */
    private debug(taskId: string, message: string): void {
        if (this.debugMode) {
            const timestamp = new Date().toISOString().substring(11, 23);
            console.log(`[BG-DEBUG ${timestamp}] ${taskId}: ${message}`);
        }
    }

    /**
     * Run a command in the background
     */
    run(options: RunBackgroundOptions): BackgroundTask {
        const id = this.generateId();
        const { command, cwd = process.cwd(), timeout = 300000, label } = options;

        // Parse command into executable and args
        // Handle shell commands properly
        const isWindows = process.platform === "win32";
        const shell = isWindows ? "cmd.exe" : "/bin/sh";
        const shellFlag = isWindows ? "/c" : "-c";

        const task: BackgroundTask = {
            id,
            command,
            args: [shellFlag, command],
            cwd,
            label,
            status: "running",
            output: "",
            errorOutput: "",
            exitCode: null,
            startTime: Date.now(),
            timeout,
        };

        this.tasks.set(id, task);
        this.debug(id, `Starting: ${command} (cwd: ${cwd})`);

        // Spawn the process
        try {
            const proc = spawn(shell, task.args, {
                cwd,
                stdio: ["ignore", "pipe", "pipe"],
                detached: false,
            });

            task.process = proc;

            // Collect stdout
            proc.stdout?.on("data", (data: Buffer) => {
                const text = data.toString();
                task.output += text;
                this.debug(id, `stdout: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`);
            });

            // Collect stderr
            proc.stderr?.on("data", (data: Buffer) => {
                const text = data.toString();
                task.errorOutput += text;
                this.debug(id, `stderr: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`);
            });

            // Handle completion
            proc.on("close", (code: number | null) => {
                task.exitCode = code;
                task.endTime = Date.now();
                task.status = code === 0 ? "done" : "error";
                task.process = undefined;

                const duration = ((task.endTime - task.startTime) / 1000).toFixed(2);
                this.debug(id, `Completed with code ${code} in ${duration}s`);
            });

            // Handle errors
            proc.on("error", (err: Error) => {
                task.status = "error";
                task.errorOutput += `\nProcess error: ${err.message}`;
                task.endTime = Date.now();
                task.process = undefined;
                this.debug(id, `Error: ${err.message}`);
            });

            // Set timeout
            setTimeout(() => {
                if (task.status === "running" && task.process) {
                    this.debug(id, `Timeout after ${timeout}ms, killing process`);
                    task.process.kill("SIGKILL");
                    task.status = "timeout";
                    task.endTime = Date.now();
                    task.errorOutput += `\nProcess killed: timeout after ${timeout}ms`;
                }
            }, timeout);

        } catch (err) {
            task.status = "error";
            task.errorOutput = `Failed to spawn: ${err instanceof Error ? err.message : String(err)}`;
            task.endTime = Date.now();
            this.debug(id, `Spawn failed: ${task.errorOutput}`);
        }

        return task;
    }

    /**
     * Get task by ID
     */
    get(taskId: string): BackgroundTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Get all tasks
     */
    getAll(): BackgroundTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get tasks by status
     */
    getByStatus(status: TaskStatus): BackgroundTask[] {
        return this.getAll().filter(t => t.status === status);
    }

    /**
     * Clear completed/failed tasks
     */
    clearCompleted(): number {
        let count = 0;
        for (const [id, task] of this.tasks) {
            if (task.status !== "running" && task.status !== "pending") {
                this.tasks.delete(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Kill a running task
     */
    kill(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (task?.process) {
            task.process.kill("SIGKILL");
            task.status = "error";
            task.errorOutput += "\nKilled by user";
            task.endTime = Date.now();
            this.debug(taskId, "Killed by user");
            return true;
        }
        return false;
    }

    /**
     * Format duration for display
     */
    formatDuration(task: BackgroundTask): string {
        const end = task.endTime || Date.now();
        const seconds = (end - task.startTime) / 1000;
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    }

    /**
     * Get status emoji
     */
    getStatusEmoji(status: TaskStatus): string {
        switch (status) {
            case "pending": return "⏸️";
            case "running": return "⏳";
            case "done": return "✅";
            case "error": return "❌";
            case "timeout": return "⏰";
            default: return "❓";
        }
    }
}

// Export singleton instance
export const backgroundTaskManager = BackgroundTaskManager.instance;
