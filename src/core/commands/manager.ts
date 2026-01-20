/**
 * Background Task Manager
 * 
 * Runs shell commands in the background and tracks their output.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { ID_PREFIX, getStatusIndicator, STATUS_LABEL, CLI_NAME } from "../../shared/index.js";
import type { BackgroundTask } from "./interfaces/background-task.js";
import type { BackgroundTaskStatus } from "./types/background-task-status.js";
import type { RunBackgroundOptions } from "./interfaces/run-background-options.js";

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
        const shell = isWindows ? "cmd.exe" : CLI_NAME.SH;
        const shellFlag = isWindows ? "/c" : "-c";

        const task: BackgroundTask = {
            id,
            command,
            args: [shellFlag, command],
            cwd,
            label,
            status: STATUS_LABEL.RUNNING,
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
                task.status = code === 0 ? STATUS_LABEL.DONE : STATUS_LABEL.ERROR;
                task.process = undefined;
                this.debug(id, `Done (code=${code})`);
            });

            proc.on("error", (err: Error) => {
                task.status = STATUS_LABEL.ERROR;
                task.errorOutput += `\nProcess error: ${err.message}`;
                task.endTime = Date.now();
                task.process = undefined;
            });

            setTimeout(() => {
                if (task.status === STATUS_LABEL.RUNNING && task.process) {
                    task.process.kill("SIGKILL");
                    task.status = STATUS_LABEL.TIMEOUT;
                    task.endTime = Date.now();
                    this.debug(id, "Timeout");
                }
            }, timeout);

        } catch (err) {
            task.status = STATUS_LABEL.ERROR;
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
            if (task.status !== STATUS_LABEL.RUNNING && task.status !== STATUS_LABEL.PENDING) {
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
            task.status = STATUS_LABEL.ERROR;
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
        return getStatusIndicator(status);
    }

}

export const backgroundTaskManager = BackgroundTaskManager.instance;
