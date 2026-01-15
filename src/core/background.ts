/**
 * Background Task Manager for OpenCode Orchestrator
 *
 * Enables running commands in the background and checking their status later.
 * This allows the AI to continue working while long-running tasks execute.
 */

import { spawn, ChildProcess } from "child_process";
import { randomBytes } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// BackgroundTaskManager Singleton
// ============================================================================

class BackgroundTaskManager {
  private static _instance: BackgroundTaskManager;
  private tasks: Map<string, BackgroundTask> = new Map();
  private debugMode: boolean = true; // Enable debug mode
  private storageDir: string;
  private storageFile: string;
  private monitoringInterval?: ReturnType<typeof setInterval>;

  private constructor() {
    this.storageDir = join(homedir(), ".opencode-orchestrator");
    this.storageFile = join(this.storageDir, "tasks.json");
    this.loadFromDisk();
    this.startMonitoring();
  }

  static get instance(): BackgroundTaskManager {
    if (!BackgroundTaskManager._instance) {
      BackgroundTaskManager._instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager._instance;
  }

  /**
   * Generate a unique task ID in the format job_xxxxxxxx
   */
  private generateId(): string {
    const hex = randomBytes(4).toString("hex");
    return `job_${hex}`;
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDir(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
      this.debug("system", `Created storage directory: ${this.storageDir}`);
    }
  }

  /**
   * Load tasks from disk on startup
   */
  private loadFromDisk(): void {
    this.ensureStorageDir();
    if (!existsSync(this.storageFile)) {
      this.debug("system", "No existing task data on disk");
      return;
    }

    try {
      const data = readFileSync(this.storageFile, "utf-8");
      const tasksData = JSON.parse(data);

      for (const [id, taskData] of Object.entries(tasksData)) {
        const task = taskData as BackgroundTask;

        // Reset process reference on load (cannot restore ChildProcess)
        task.process = undefined;

        // If task was running, mark as error since process is gone
        if (task.status === "running") {
          task.status = "error";
          task.errorOutput += "\n[Process lost on restart]";
          task.endTime = Date.now();
          task.exitCode = null;
        }

        this.tasks.set(id, task);
      }

      this.debug("system", `Loaded ${this.tasks.size} tasks from disk`);
    } catch (error) {
      this.debug(
        "system",
        `Failed to load tasks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Save tasks to disk
   */
  private saveToDisk(): void {
    this.ensureStorageDir();

    try {
      const tasksData: Record<string, BackgroundTask> = {};
      for (const [id, task] of this.tasks.entries()) {
        tasksData[id] = task;
      }

      writeFileSync(
        this.storageFile,
        JSON.stringify(tasksData, null, 2),
        "utf-8",
      );
    } catch (error) {
      this.debug(
        "system",
        `Failed to save tasks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Start periodic monitoring of running processes
   */
  private startMonitoring(): void {
    const MONITOR_INTERVAL_MS = 5000; // Check every 5 seconds

    this.monitoringInterval = setInterval(() => {
      this.monitorRunningProcesses();
    }, MONITOR_INTERVAL_MS);

    if (this.monitoringInterval) {
      this.monitoringInterval.unref();
    }
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Monitor running processes and detect zombie processes
   */
  private monitorRunningProcesses(): void {
    const now = Date.now();
    let hasRunningTasks = false;

    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== "running") continue;

      hasRunningTasks = true;

      if (task.process && task.process.pid) {
        const pid = task.process.pid;

        // Check if process is still alive
        try {
          process.kill(pid, 0);
        } catch (error) {
          // Process is dead
          task.status = "error";
          task.errorOutput += `\nProcess disappeared (PID ${pid})`;
          task.endTime = Date.now();
          task.exitCode = null;
          task.process = undefined;

          this.saveToDisk();
          this.debug(id, `Process dead (PID ${pid}), marked as error`);
        }
      } else if (task.process) {
        // No process reference but status is running
        task.status = "error";
        task.errorOutput += "\nProcess reference lost";
        task.endTime = Date.now();
        task.exitCode = null;

        this.saveToDisk();
        this.debug(id, "Process reference lost, marked as error");
      }
    }

    if (!hasRunningTasks && this.monitoringInterval) {
      this.stopMonitoring();
    }
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
    this.saveToDisk();
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
        this.debug(
          id,
          `stdout: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
        );
      });

      // Collect stderr
      proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        task.errorOutput += text;
        this.debug(
          id,
          `stderr: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
        );
      });

      // Handle completion
      proc.on("close", (code: number | null) => {
        task.exitCode = code;
        task.endTime = Date.now();
        task.status = code === 0 ? "done" : "error";
        task.process = undefined;

        this.saveToDisk();
        const duration = ((task.endTime - task.startTime) / 1000).toFixed(2);
        this.debug(id, `Completed with code ${code} in ${duration}s`);
      });

      // Handle errors
      proc.on("error", (err: Error) => {
        task.status = "error";
        task.errorOutput += `\nProcess error: ${err.message}`;
        task.endTime = Date.now();
        task.process = undefined;

        this.saveToDisk();
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

          this.saveToDisk();
        }
      }, timeout);
    } catch (err) {
      task.status = "error";
      task.errorOutput = `Failed to spawn: ${err instanceof Error ? err.message : String(err)}`;
      task.endTime = Date.now();

      this.saveToDisk();
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
    return this.getAll().filter((t) => t.status === status);
  }

  /**
   * Clean up tasks by session ID
   */
  cleanupBySession(sessionID: string): number {
    let count = 0;
    for (const [id, task] of this.tasks) {
      if (task.sessionID === sessionID) {
        // Kill if running
        if (task.process && task.status === "running") {
          task.process.kill("SIGKILL");
        }

        this.tasks.delete(id);
        count++;
        this.debug(id, `Cleaned up for session ${sessionID}`);
      }
    }

    this.saveToDisk();
    return count;
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

    this.saveToDisk();
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

      this.saveToDisk();
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
      case "pending":
        return "⏸️";
      case "running":
        return "⏳";
      case "done":
        return "✅";
      case "error":
        return "❌";
      case "timeout":
        return "⏰";
      default:
        return "❓";
    }
  }
}

// Export singleton instance
export const backgroundTaskManager = BackgroundTaskManager.instance;
