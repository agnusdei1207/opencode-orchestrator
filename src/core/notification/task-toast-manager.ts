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
import { TASK_STATUS, STATUS_LABEL, TUI_ICONS, TUI_BLOCKS, TUI_TAGS, TUI_MESSAGES, type TaskStatus, type TrackedTask, type TaskCompletionInfo } from "../../shared/index.js";
import type { TodoSyncService } from "../sync/todo-sync-service.js";
import { sanitizeToastInline, sanitizeToastMessage, sanitizeToastTitle } from "./toast-sanitizer.js";

// ============================================================
// Types
// ============================================================

// Re-export for backward compatibility and internal usage
export type { TaskStatus, TrackedTask, TaskCompletionInfo } from "../../shared/index.js";

type OpencodeClient = PluginInput["client"];

// ============================================================
// Task Toast Manager Class
// ============================================================

export class TaskToastManager {
    private tasks: Map<string, TrackedTask> = new Map();
    private client: OpencodeClient | null = null;
    private concurrency: ConcurrencyController | null = null;
    private todoSync: TodoSyncService | null = null;

    private getSafeTaskDescription(task: Pick<TrackedTask, "description">): string {
        return sanitizeToastInline(task.description, 100) || "Untitled task";
    }

    private getSafeAgent(agent: string): string {
        return sanitizeToastInline(agent, 32) || "unknown";
    }

    private showToast(title: string, message: string, variant: "success" | "error" | "warning" | "info", duration: number): void {
        if (!this.client || !this.client.tui) return;

        this.client.tui.showToast({
            body: {
                title: sanitizeToastTitle(title) || "Notification",
                message: sanitizeToastMessage(message),
                variant,
                duration,
            },
        }).catch(() => { });
    }

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
     * Set TodoSyncService for TUI status synchronization
     */
    setTodoSync(service: TodoSyncService): void {
        this.todoSync = service;
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
            status: task.status ?? STATUS_LABEL.RUNNING,
            startedAt: new Date(),
            isBackground: task.isBackground,
            parentSessionID: task.parentSessionID,
            sessionID: task.sessionID,
        };

        this.tasks.set(task.id, trackedTask);
        this.todoSync?.updateTaskStatus(trackedTask);
        this.showTaskListToast(trackedTask);
    }

    /**
     * Update task status
     */
    updateTask(id: string, status: TaskStatus): void {
        const task = this.tasks.get(id);
        if (task) {
            task.status = status;
            this.todoSync?.updateTaskStatus(task);
        }
    }

    /**
     * Remove a task
     */
    removeTask(id: string): void {
        this.tasks.delete(id);
        this.todoSync?.removeTask(id);
    }

    /**
     * Get all running tasks (newest first)
     */
    getRunningTasks(): TrackedTask[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.status === STATUS_LABEL.RUNNING)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }

    /**
     * Get all queued tasks (oldest first - FIFO)
     */
    getQueuedTasks(): TrackedTask[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.status === STATUS_LABEL.QUEUED)
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
    /**
     * Get concurrency info string (e.g., " [2/5]")
     */
    private getConcurrencyInfo(): string {
        if (!this.concurrency) return "";
        const running = this.getRunningTasks();
        const queued = this.getQueuedTasks();
        const total = running.length;

        // Use "default" as a representative key for now, assuming mostly default agents
        const limit = this.concurrency.getConcurrencyLimit("default");

        if (limit === Infinity) return "";

        // ▣/▢ style blocks for visual concurrency
        const filled = TUI_BLOCKS.FILLED.repeat(total);
        const empty = TUI_BLOCKS.EMPTY.repeat(Math.max(0, limit - total));

        return ` [${filled}${empty} ${total}/${limit}]`;
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
            lines.push(`${TUI_ICONS.RUNNING} Running (${running.length}) ${concurrencyInfo}`);
            for (const task of running) {
                const duration = this.formatDuration(task.startedAt);
                const bgTag = task.isBackground ? TUI_TAGS.BACKGROUND : TUI_TAGS.FOREGROUND;
                const isNew = newTask && task.id === newTask.id ? TUI_ICONS.NEW : "";
                lines.push(`${bgTag} ${this.getSafeTaskDescription(task)} (${this.getSafeAgent(task.agent)}) - ${duration}${isNew}`);
            }
        }

        // Queued tasks
        if (queued.length > 0) {
            if (lines.length > 0) lines.push("");
            lines.push(`${TUI_ICONS.QUEUED} Queued (${queued.length}):`);
            for (const task of queued) {
                const bgTag = task.isBackground ? TUI_TAGS.WAITING : TUI_TAGS.PENDING;
                lines.push(`${bgTag} ${this.getSafeTaskDescription(task)} (${this.getSafeAgent(task.agent)})`);
            }
        }

        return lines.join("\n");
    }

    /**
     * Show consolidated toast with all running/queued tasks
     */
    private showTaskListToast(newTask: TrackedTask): void {
        const message = this.buildTaskListMessage(newTask);
        const running = this.getRunningTasks();
        const queued = this.getQueuedTasks();

        const title = newTask.isBackground
            ? `Background Task Started`
            : `Task Started`;

        this.showToast(
            title,
            message || `${this.getSafeTaskDescription(newTask)} (${this.getSafeAgent(newTask.agent)})`,
            STATUS_LABEL.INFO,
            running.length + queued.length > 2 ? 5000 : 3000
        );
    }

    /**
     * Show task completion toast
     */
    showCompletionToast(info: TaskCompletionInfo): void {
        // Remove the completed task
        this.removeTask(info.id);

        const remaining = this.getRunningTasks();
        const queued = this.getQueuedTasks();

        let message: string;
        let title: string;
        let variant: "success" | "error" | "warning";
        const safeDescription = sanitizeToastInline(info.description, 100) || "Untitled task";
        const safeError = info.error ? sanitizeToastMessage(info.error, 240, 4) : "";

        if (info.status === STATUS_LABEL.ERROR || info.status === STATUS_LABEL.CANCELLED || info.status === STATUS_LABEL.FAILED) {
            title = info.status === STATUS_LABEL.ERROR ? "Task Failed" : "Task Cancelled";
            message = `[FAIL] "${safeDescription}" ${info.status}\n${safeError}`;
            variant = STATUS_LABEL.ERROR;
        } else {
            title = "Task Completed";
            message = `[DONE] "${safeDescription}" finished in ${info.duration}`;
            variant = STATUS_LABEL.SUCCESS;
        }

        if (remaining.length > 0 || queued.length > 0) {
            message += `\n\nStill running: ${remaining.length} | Queued: ${queued.length}`;
        }

        this.showToast(title, message, variant, 5000);
    }

    /**
     * Show all-tasks-complete summary toast
     */
    showAllCompleteToast(parentSessionID: string, completedTasks: TaskCompletionInfo[]): void {
        const successCount = completedTasks.filter(t => t.status === STATUS_LABEL.COMPLETED).length;
        const failCount = completedTasks.filter(t => t.status === STATUS_LABEL.ERROR || t.status === STATUS_LABEL.CANCELLED || t.status === STATUS_LABEL.FAILED).length;

        const taskList = completedTasks
            .map(t => `- [${t.status === STATUS_LABEL.COMPLETED ? "OK" : "FAIL"}] ${sanitizeToastInline(t.description, 80) || "Untitled task"} (${t.duration})`)
            .join("\n");

        this.showToast(
            "All Tasks Completed",
            `${successCount} succeeded, ${failCount} failed\n\n${taskList}`,
            failCount > 0 ? STATUS_LABEL.WARNING : STATUS_LABEL.SUCCESS,
            7000
        );
    }

    /**
     * Show Mission Complete toast (Grand Finale)
     */
    showMissionCompleteToast(title: string = "Mission Complete", message: string = "All tasks completed successfully."): void {
        // Visual flourish for completion
        const decoratedMessage = `
${TUI_ICONS.MISSION_COMPLETE} ${TUI_MESSAGES.MISSION_COMPLETE_TITLE} ${TUI_ICONS.MISSION_COMPLETE}
──────────────────────────
${message}
──────────────────────────
${TUI_MESSAGES.MISSION_COMPLETE_SUBTITLE}
`.trim();

        this.showToast(`${TUI_ICONS.SHIELD} ${title}`, decoratedMessage, STATUS_LABEL.SUCCESS, 10000);
    }

    /**
     * Show progress toast (for long-running tasks)
     */
    showProgressToast(taskId: string, progress: { current: number; total: number; message?: string }): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const percentage = Math.round((progress.current / progress.total) * 100);
        const progressBar = `[${"#".repeat(Math.floor(percentage / 10))}${"-".repeat(10 - Math.floor(percentage / 10))}]`;

        this.showToast(
            `Task Progress: ${this.getSafeTaskDescription(task)}`,
            `${progressBar} ${percentage}%\n${progress.message || ""}`,
            STATUS_LABEL.INFO,
            2000
        );
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
