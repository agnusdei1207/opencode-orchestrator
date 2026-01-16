/**
 * Background Task Manager
 * 
 * Runs shell commands in the background and tracks their output.
 */

import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { ID_PREFIX, getStatusEmoji } from "../../shared/constants.js";
import type { BackgroundTask, BackgroundTaskStatus, RunBackgroundOptions } from "./types.js";

class BackgroundTaskManager {
    private static _instance: BackgroundTaskManager;
    private tasks: Map<string, BackgroundTask> = new Map();
    private debugMode = process.env.DEBUG_BG_TASK === "true"; // Disabled by default

    private constructor() { }

    static get instance(): BackgroundTaskManager {
        if (!BackgroundTaskManager._instance) {
            BackgroundTaskManager._instance = new BackgroundTaskManager();
        }
        return BackgroundTaskManager._instance;
    }

    private generateId(): string {
        return `${ID_PREFIX.JOB}${randomBytes(4).toString("hex")}`;
    }

    private debug(taskId: string, message: string): void {
        if (this.debugMode) {
            const ts = new Date().toISOString().substring(11, 23);
            console.log(`[BG ${ts}] ${taskId}: ${message}`);
        }
    }

    run(options: RunBackgroundOptions): BackgroundTask {
        const id = this.generateId();
        const { command, cwd = process.cwd(), timeout = 300000, label } = options;

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
        this.debug(id, `Starting: ${command}`);

        try {
            const proc = spawn(shell, task.args, {
                cwd,
                stdio: ["ignore", "pipe", "pipe"],
                detached: false,
            });

            task.process = proc;

            proc.stdout?.on("data", (data: Buffer) => {
                task.output += data.toString();
            });

            proc.stderr?.on("data", (data: Buffer) => {
                task.errorOutput += data.toString();
            });

            proc.on("close", (code: number | null) => {
                task.exitCode = code;
                task.endTime = Date.now();
                task.status = code === 0 ? "done" : "error";
                task.process = undefined;
                this.debug(id, `Done (code=${code})`);
            });

            proc.on("error", (err: Error) => {
                task.status = "error";
                task.errorOutput += `\nProcess error: ${err.message}`;
                task.endTime = Date.now();
                task.process = undefined;
            });

            setTimeout(() => {
                if (task.status === "running" && task.process) {
                    task.process.kill("SIGKILL");
                    task.status = "timeout";
                    task.endTime = Date.now();
                    this.debug(id, "Timeout");
                }
            }, timeout);

        } catch (err) {
            task.status = "error";
            task.errorOutput = `Spawn failed: ${err instanceof Error ? err.message : String(err)}`;
            task.endTime = Date.now();
        }

        return task;
    }

    get(taskId: string): BackgroundTask | undefined {
        return this.tasks.get(taskId);
    }

    getAll(): BackgroundTask[] {
        return Array.from(this.tasks.values());
    }

    getByStatus(status: BackgroundTaskStatus): BackgroundTask[] {
        return this.getAll().filter(t => t.status === status);
    }

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

    kill(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (task?.process) {
            task.process.kill("SIGKILL");
            task.status = "error";
            task.errorOutput += "\nKilled by user";
            task.endTime = Date.now();
            return true;
        }
        return false;
    }

    formatDuration(task: BackgroundTask): string {
        const end = task.endTime || Date.now();
        const seconds = (end - task.startTime) / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
    }

    getStatusEmoji(status: BackgroundTaskStatus): string {
        return getStatusEmoji(status);
    }
}

export const backgroundTaskManager = BackgroundTaskManager.instance;
