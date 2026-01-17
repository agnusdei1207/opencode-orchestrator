/**
 * Task Toast Manager
 * 
 * Manages toast notifications for parallel/background tasks.
 * Provides consolidated view of running and queued tasks.
 * 
 * Features:
 * - Real-time task status display
 * - Concurrency info (e.g., "2/5 slots")
 * - New task highlighting
 * - Completion summaries
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { ConcurrencyController } from "../agents/concurrency.js";

// ============================================================
// Types
// ============================================================

type OpencodeClient = PluginInput["client"];

export type TaskStatus = "running" | "queued" | "completed" | "error" | "cancelled";

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

// ============================================================
// Task Toast Manager Class
// ============================================================

export class TaskToastManager {
    private tasks: Map<string, TrackedTask> = new Map();
    private client: OpencodeClient | null = null;
    private concurrency: ConcurrencyController | null = null;

    /**
     * Initialize the manager with OpenCode client
     */
    init(client: OpencodeClient, concurrency?: ConcurrencyController): void {
        this.client = client;
        this.concurrency = concurrency ?? null;
    }

    /**
     * Set concurrency controller (can be set after init)
     */
    setConcurrencyController(concurrency: ConcurrencyController): void {
        this.concurrency = concurrency;
    }

    /**
     * Add a new task and show consolidated toast
     */
    addTask(task: {
        id: string;
        description: string;
        agent: string;
        isBackground: boolean;
        parentSessionID?: string;
        sessionID?: string;
        status?: TaskStatus;
    }): void {
        const trackedTask: TrackedTask = {
            id: task.id,
            description: task.description,
            agent: task.agent,
            status: task.status ?? "running",
            startedAt: new Date(),
            isBackground: task.isBackground,
            parentSessionID: task.parentSessionID,
            sessionID: task.sessionID,
        };

        this.tasks.set(task.id, trackedTask);
        this.showTaskListToast(trackedTask);
    }

    /**
     * Update task status
     */
    updateTask(id: string, status: TaskStatus): void {
        const task = this.tasks.get(id);
        if (task) {
            task.status = status;
        }
    }

    /**
     * Remove a task
     */
    removeTask(id: string): void {
        this.tasks.delete(id);
    }

    /**
     * Get all running tasks (newest first)
     */
    getRunningTasks(): TrackedTask[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.status === "running")
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }

    /**
     * Get all queued tasks (oldest first - FIFO)
     */
    getQueuedTasks(): TrackedTask[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.status === "queued")
            .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    }

    /**
     * Get tasks by parent session
     */
    getTasksByParent(parentSessionID: string): TrackedTask[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.parentSessionID === parentSessionID);
    }

    /**
     * Format duration since task started
     */
    private formatDuration(startedAt: Date): string {
        const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    }

    /**
     * Get concurrency info string (e.g., " [2/5]")
     */
    private getConcurrencyInfo(): string {
        if (!this.concurrency) return "";
        const running = this.getRunningTasks();
        const queued = this.getQueuedTasks();
        const total = running.length + queued.length;
        // Use "default" as a representative key
        const limit = this.concurrency.getConcurrencyLimit("default");
        if (limit === Infinity) return "";
        return ` [${total}/${limit}]`;
    }

    /**
     * Build consolidated task list message
     */
    private buildTaskListMessage(newTask?: TrackedTask): string {
        const running = this.getRunningTasks();
        const queued = this.getQueuedTasks();
        const concurrencyInfo = this.getConcurrencyInfo();

        const lines: string[] = [];

        // Running tasks
        if (running.length > 0) {
            lines.push(`Running (${running.length}):${concurrencyInfo}`);
            for (const task of running) {
                const duration = this.formatDuration(task.startedAt);
                const bgIcon = task.isBackground ? "⚡" : "🔄";
                const isNew = newTask && task.id === newTask.id ? " ← NEW" : "";
                lines.push(`${bgIcon} ${task.description} (${task.agent}) - ${duration}${isNew}`);
            }
        }

        // Queued tasks
        if (queued.length > 0) {
            if (lines.length > 0) lines.push("");
            lines.push(`Queued (${queued.length}):`);
            for (const task of queued) {
                const bgIcon = task.isBackground ? "⏳" : "⏸️";
                lines.push(`${bgIcon} ${task.description} (${task.agent})`);
            }
        }

        return lines.join("\n");
    }

    /**
     * Show consolidated toast with all running/queued tasks
     */
    private showTaskListToast(newTask: TrackedTask): void {
        if (!this.client) return;

        const tuiClient = this.client as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (!tuiClient.tui?.showToast) return;

        const message = this.buildTaskListMessage(newTask);
        const running = this.getRunningTasks();
        const queued = this.getQueuedTasks();

        const title = newTask.isBackground
            ? `⚡ New Background Task`
            : `🔄 New Task Started`;

        tuiClient.tui.showToast({
            body: {
                title,
                message: message || `${newTask.description} (${newTask.agent})`,
                variant: "info",
                duration: running.length + queued.length > 2 ? 5000 : 3000,
            },
        }).catch(() => { });
    }

    /**
     * Show task completion toast
     */
    showCompletionToast(info: TaskCompletionInfo): void {
        if (!this.client) return;

        const tuiClient = this.client as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (!tuiClient.tui?.showToast) return;

        // Remove the completed task
        this.removeTask(info.id);

        const remaining = this.getRunningTasks();
        const queued = this.getQueuedTasks();

        let message: string;
        let title: string;
        let variant: "success" | "error" | "warning";

        if (info.status === "error" || info.status === "cancelled") {
            title = info.status === "error" ? "Task Failed" : "Task Cancelled";
            message = `❌ "${info.description}" ${info.status}\n${info.error || ""}`;
            variant = "error";
        } else {
            title = "Task Completed";
            message = `✅ "${info.description}" finished in ${info.duration}`;
            variant = "success";
        }

        if (remaining.length > 0 || queued.length > 0) {
            message += `\n\nStill running: ${remaining.length} | Queued: ${queued.length}`;
        }

        tuiClient.tui.showToast({
            body: {
                title,
                message,
                variant,
                duration: 5000,
            },
        }).catch(() => { });
    }

    /**
     * Show all-tasks-complete summary toast
     */
    showAllCompleteToast(parentSessionID: string, completedTasks: TaskCompletionInfo[]): void {
        if (!this.client) return;

        const tuiClient = this.client as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (!tuiClient.tui?.showToast) return;

        const successCount = completedTasks.filter(t => t.status === "completed").length;
        const failCount = completedTasks.filter(t => t.status === "error" || t.status === "cancelled").length;

        const taskList = completedTasks
            .map(t => `- ${t.status === "completed" ? "✅" : "❌"} ${t.description} (${t.duration})`)
            .join("\n");

        tuiClient.tui.showToast({
            body: {
                title: "🎉 All Tasks Completed",
                message: `${successCount} succeeded, ${failCount} failed\n\n${taskList}`,
                variant: failCount > 0 ? "warning" : "success",
                duration: 7000,
            },
        }).catch(() => { });
    }

    /**
     * Show progress toast (for long-running tasks)
     */
    showProgressToast(taskId: string, progress: { current: number; total: number; message?: string }): void {
        if (!this.client) return;

        const tuiClient = this.client as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (!tuiClient.tui?.showToast) return;

        const task = this.tasks.get(taskId);
        if (!task) return;

        const percentage = Math.round((progress.current / progress.total) * 100);
        const progressBar = `[${"█".repeat(Math.floor(percentage / 10))}${"░".repeat(10 - Math.floor(percentage / 10))}]`;

        tuiClient.tui.showToast({
            body: {
                title: `⏳ ${task.description}`,
                message: `${progressBar} ${percentage}%\n${progress.message || ""}`,
                variant: "info",
                duration: 2000,
            },
        }).catch(() => { });
    }

    /**
     * Clear all tracked tasks
     */
    clear(): void {
        this.tasks.clear();
    }

    /**
     * Get task count stats
     */
    getStats(): { running: number; queued: number; total: number } {
        const running = this.getRunningTasks().length;
        const queued = this.getQueuedTasks().length;
        return { running, queued, total: this.tasks.size };
    }
}

// ============================================================
// Singleton Instance
// ============================================================

let instance: TaskToastManager | null = null;

/**
 * Get the global TaskToastManager instance
 */
export function getTaskToastManager(): TaskToastManager | null {
    return instance;
}

/**
 * Initialize the global TaskToastManager
 */
export function initTaskToastManager(
    client: OpencodeClient,
    concurrency?: ConcurrencyController
): TaskToastManager {
    if (!instance) {
        instance = new TaskToastManager();
    }
    instance.init(client, concurrency);
    return instance;
}
