/**
 * Background Task Manager
 * 
 * Runs shell commands in the background and tracks their output.
 */

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
    ID_PREFIX,
    getStatusIndicator,
    STATUS_LABEL,
    CLI_NAME,
    PLATFORM,
    type BackgroundTask,
    type BackgroundTaskStatus,
    type RunBackgroundOptions,
} from "../../shared/index.js";
import { log as internalLog } from "../agents/logger.js";

interface ManagedBackgroundTask extends BackgroundTask {
    timeoutHandle?: NodeJS.Timeout;
    stopping?: Promise<boolean>;
    termination?: { status: BackgroundTaskStatus; message: string };
}

const TERMINATION_TIMEOUT_MS = 2_000;

class BackgroundTaskManager {
    private static _instance: BackgroundTaskManager;
    private tasks: Map<string, ManagedBackgroundTask> = new Map();
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
            internalLog(`[BG ${ts}] ${taskId}: ${message}`);
        }
    }

    run(options: RunBackgroundOptions): BackgroundTask {
        const id = this.generateId();
        const { command, cwd = process.cwd(), timeout = 300000, label } = options;

        const isWindows = process.platform === PLATFORM.WIN32;
        const shell = isWindows ? "cmd.exe" : CLI_NAME.SH;

        const task: ManagedBackgroundTask = {
            id,
            command,
            args: isWindows ? ["/d", "/s", "/c", `"${command}"`] : ["-c", command],
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
                detached: !isWindows,
                windowsHide: true,
                windowsVerbatimArguments: isWindows,
            });

            task.process = proc;

            // Cleanup function to remove all listeners
            const cleanup = () => this.cleanupTaskResources(task);

            proc.stdout?.on("data", (data: Buffer) => {
                task.output += data.toString();
            });

            proc.stderr?.on("data", (data: Buffer) => {
                task.errorOutput += data.toString();
            });

            proc.on("close", (code: number | null) => {
                task.exitCode = code;
                task.endTime = Date.now();
                if (task.termination) {
                    task.status = task.termination.status;
                    task.errorOutput += `\n${task.termination.message}`;
                } else if (task.status === STATUS_LABEL.RUNNING) {
                    task.status = code === 0 ? STATUS_LABEL.DONE : STATUS_LABEL.ERROR;
                }
                cleanup(); // GUARANTEED cleanup
                this.debug(id, `Done (code=${code})`);
            });

            proc.on("error", (err: Error) => {
                task.errorOutput += `\nProcess error: ${err.message}`;
                // A failed signal also emits error; only close confirms exit.
            });

            task.timeoutHandle = setTimeout(async () => {
                if (task.status === STATUS_LABEL.RUNNING && task.process) {
                    if (!await this.terminateTask(task, STATUS_LABEL.TIMEOUT, "Timed out")) {
                        task.errorOutput += "\nTimeout termination failed; task may still be running";
                    }
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

    async kill(taskId: string): Promise<boolean> {
        const task = this.tasks.get(taskId);
        if (!task?.process) return false;
        return this.terminateTask(task, STATUS_LABEL.ERROR, "Killed by user");
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

    /**
     * Shutdown - kills all running processes and clears tasks
     */
    async shutdown(): Promise<void> {
        const failed: string[] = [];
        await Promise.all([...this.tasks.values()].map(async task => {
            if (task.process && !await this.terminateTask(task, STATUS_LABEL.ERROR, "Stopped on shutdown")) {
                failed.push(task.id);
                return;
            }
            this.cleanupTaskResources(task);
            this.tasks.delete(task.id);
        }));
        if (failed.length) throw new Error(`Could not terminate background tasks: ${failed.join(", ")}`);
    }

    private signalTask(task: ManagedBackgroundTask): boolean {
        try {
            const proc = task.process;
            if (!proc?.pid) return proc?.kill("SIGKILL") ?? false;
            if (process.platform !== PLATFORM.WIN32) return process.kill(-proc.pid, "SIGKILL");
            const result = spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
                windowsHide: true,
                timeout: TERMINATION_TIMEOUT_MS,
            });
            return result.status === 0;
        } catch (error) {
            internalLog(`[BackgroundTask] Failed to signal ${task.id}`, error);
            return false;
        }
    }

    private terminateTask(task: ManagedBackgroundTask, status: BackgroundTaskStatus, message: string): Promise<boolean> {
        if (task.stopping) return task.stopping;
        const proc = task.process;
        if (!proc) return Promise.resolve(true);
        task.termination = { status, message };
        task.stopping = new Promise<boolean>(resolve => {
            const finish = (closed: boolean) => {
                clearTimeout(timer);
                proc.removeListener("close", onClose);
                if (!closed) task.termination = undefined;
                resolve(closed);
            };
            const onClose = () => finish(true);
            const timer = setTimeout(() => finish(false), TERMINATION_TIMEOUT_MS);
            proc.once("close", onClose);
            if (!this.signalTask(task)) finish(false);
        }).finally(() => { task.stopping = undefined; });
        return task.stopping;
    }

    private cleanupTaskResources(task: ManagedBackgroundTask): void {
        if (task.timeoutHandle) {
            clearTimeout(task.timeoutHandle);
            task.timeoutHandle = undefined;
        }

        const proc = task.process;
        if (!proc) return;

        proc.stdout?.removeAllListeners();
        proc.stderr?.removeAllListeners();
        proc.removeAllListeners();
        proc.stdout?.unpipe();
        proc.stderr?.unpipe();
        task.process = undefined;
    }

}

export const backgroundTaskManager = BackgroundTaskManager.instance;
