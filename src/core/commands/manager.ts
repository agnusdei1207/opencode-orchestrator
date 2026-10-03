/**
 * Background Task Manager
 * 
 * Runs shell commands in the background and tracks their output.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
    BACKGROUND_TASK,
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

/**
 * Kill a Windows process tree. taskkill runs asynchronously (spawnSync would
 * block the event loop for up to the termination timeout); spawn's timeout
 * kills a hung taskkill, which then reports a non-zero close.
 */
function killWindowsTree(pid: number): Promise<boolean> {
    return new Promise(resolve => {
        const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
            timeout: TERMINATION_TIMEOUT_MS,
        });
        killer.once("error", () => resolve(false));
        killer.once("close", code => resolve(code === 0));
    });
}

// A long-running command can print without bound; keep only the recent tail,
// which is what check_background shows anyway.
function appendBounded(current: string, chunk: string): string {
    const combined = current + chunk;
    if (combined.length <= BACKGROUND_TASK.MAX_OUTPUT_LENGTH) return combined;
    const tail = combined.slice(-BACKGROUND_TASK.MAX_OUTPUT_LENGTH);
    const body = tail.startsWith(BACKGROUND_TASK.OUTPUT_TRUNCATION_MARKER)
        ? tail.slice(BACKGROUND_TASK.OUTPUT_TRUNCATION_MARKER.length)
        : tail;
    return BACKGROUND_TASK.OUTPUT_TRUNCATION_MARKER + body;
}

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
        const task = this.createTask(options);
        this.tasks.set(task.id, task);
        this.debug(task.id, `Starting: ${task.command}`);

        try {
            this.startTaskProcess(task);
        } catch (error) {
            task.status = STATUS_LABEL.ERROR;
            task.errorOutput = `Spawn failed: ${error instanceof Error ? error.message : String(error)}`;
            task.endTime = Date.now();
        }

        return task;
    }

    private createTask(options: RunBackgroundOptions): ManagedBackgroundTask {
        const { command, cwd = process.cwd(), timeout = 300000, label } = options;
        const isWindows = process.platform === PLATFORM.WIN32;
        return {
            id: this.generateId(),
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
    }

    private startTaskProcess(task: ManagedBackgroundTask): void {
        const isWindows = process.platform === PLATFORM.WIN32;
        const proc = spawn(isWindows ? "cmd.exe" : CLI_NAME.SH, task.args, {
            cwd: task.cwd,
            stdio: ["ignore", "pipe", "pipe"],
            detached: !isWindows,
            windowsHide: true,
            windowsVerbatimArguments: isWindows,
        });
        task.process = proc;
        proc.stdout?.on("data", (data: Buffer) => {
            task.output = appendBounded(task.output, data.toString());
        });
        proc.stderr?.on("data", (data: Buffer) => {
            task.errorOutput = appendBounded(task.errorOutput, data.toString());
        });
        proc.on("close", code => this.finishTaskProcess(task, code));
        proc.on("error", error => {
            task.errorOutput += `\nProcess error: ${error.message}`;
        });
        task.timeoutHandle = setTimeout(() => void this.handleTaskTimeout(task), task.timeout);
    }

    private finishTaskProcess(task: ManagedBackgroundTask, code: number | null): void {
        task.exitCode = code;
        task.endTime = Date.now();
        if (task.termination) {
            task.status = task.termination.status;
            task.errorOutput += `\n${task.termination.message}`;
        } else if (task.status === STATUS_LABEL.RUNNING) {
            task.status = code === 0 ? STATUS_LABEL.DONE : STATUS_LABEL.ERROR;
        }
        this.cleanupTaskResources(task);
        this.debug(task.id, `Done (code=${code})`);
    }

    private async handleTaskTimeout(task: ManagedBackgroundTask): Promise<void> {
        if (task.status !== STATUS_LABEL.RUNNING || !task.process) return;
        if (!(await this.terminateTask(task, STATUS_LABEL.TIMEOUT, "Timed out"))) {
            task.errorOutput += "\nTimeout termination failed; task may still be running";
        }
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

    private async signalTask(task: ManagedBackgroundTask): Promise<boolean> {
        try {
            const proc = task.process;
            if (!proc?.pid) return proc?.kill("SIGKILL") ?? false;
            if (process.platform !== PLATFORM.WIN32) return process.kill(-proc.pid, "SIGKILL");
            return await killWindowsTree(proc.pid);
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
            let settled = false;
            const finish = (closed: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                proc.removeListener("close", onClose);
                if (!closed) task.termination = undefined;
                resolve(closed);
            };
            const onClose = () => finish(true);
            const timer = setTimeout(() => finish(false), TERMINATION_TIMEOUT_MS);
            proc.once("close", onClose);
            void this.signalTask(task).then(signalled => { if (!signalled) finish(false); });
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
        // An 'error' emitted with no listener throws, and a child process can
        // still report one (e.g. a failed signal) after it closed.
        proc.on("error", error => internalLog(`[BackgroundTask] Late process error for ${task.id}`, error));
        proc.stdout?.unpipe();
        proc.stderr?.unpipe();
        task.process = undefined;
    }

}

export const backgroundTaskManager = BackgroundTaskManager.instance;
