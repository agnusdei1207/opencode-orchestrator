/**
 * Task Store - Stores and manages parallel tasks
 * 
 * Features:
 * - Automatic garbage collection
 * - Memory-safe storage with limits
 * - Completed task archiving
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ParallelTask } from "./interfaces/parallel-task.interface.js";
import { MEMORY_LIMITS, PATHS, TASK_STATUS } from "../../shared/index.js";

export class TaskStore {
    private tasks: Map<string, ParallelTask> = new Map();
    private pendingByParent: Map<string, Set<string>> = new Map();
    private notifications: Map<string, ParallelTask[]> = new Map();
    private archivedCount = 0;

    set(id: string, task: ParallelTask): void {
        this.tasks.set(id, task);

        // Auto-GC if over limit
        if (this.tasks.size > MEMORY_LIMITS.MAX_TASKS_IN_MEMORY) {
            this.gc();
        }
    }

    get(id: string): ParallelTask | undefined {
        return this.tasks.get(id);
    }

    getAll(): ParallelTask[] {
        return Array.from(this.tasks.values());
    }

    getRunning(): ParallelTask[] {
        return this.getAll().filter(t => t.status === TASK_STATUS.RUNNING);
    }

    getByParent(parentSessionID: string): ParallelTask[] {
        return this.getAll().filter(t => t.parentSessionID === parentSessionID);
    }

    delete(id: string): boolean {
        return this.tasks.delete(id);
    }

    clear(): void {
        this.tasks.clear();
        this.pendingByParent.clear();
        this.notifications.clear();
    }

    // Pending tracking
    trackPending(parentSessionID: string, taskId: string): void {
        const pending = this.pendingByParent.get(parentSessionID) ?? new Set();
        pending.add(taskId);
        this.pendingByParent.set(parentSessionID, pending);
    }

    untrackPending(parentSessionID: string, taskId: string): void {
        const pending = this.pendingByParent.get(parentSessionID);
        if (pending) {
            pending.delete(taskId);
            if (pending.size === 0) {
                this.pendingByParent.delete(parentSessionID);
            }
        }
    }

    getPendingCount(parentSessionID: string): number {
        return this.pendingByParent.get(parentSessionID)?.size ?? 0;
    }

    hasPending(parentSessionID: string): boolean {
        return this.getPendingCount(parentSessionID) > 0;
    }

    // Notifications with limit
    queueNotification(task: ParallelTask): void {
        const queue = this.notifications.get(task.parentSessionID) ?? [];
        queue.push(task);

        // Limit notifications per parent
        if (queue.length > MEMORY_LIMITS.MAX_NOTIFICATIONS_PER_PARENT) {
            queue.shift(); // Remove oldest
        }

        this.notifications.set(task.parentSessionID, queue);
    }

    getNotifications(parentSessionID: string): ParallelTask[] {
        return this.notifications.get(parentSessionID) ?? [];
    }

    clearNotifications(parentSessionID: string): void {
        this.notifications.delete(parentSessionID);
    }

    cleanEmptyNotifications(): void {
        for (const [sessionID, queue] of this.notifications.entries()) {
            if (queue.length === 0) {
                this.notifications.delete(sessionID);
            }
        }
    }

    clearNotificationsForTask(taskId: string): void {
        for (const [sessionID, tasks] of this.notifications.entries()) {
            const filtered = tasks.filter(t => t.id !== taskId);
            if (filtered.length === 0) {
                this.notifications.delete(sessionID);
            } else if (filtered.length !== tasks.length) {
                this.notifications.set(sessionID, filtered);
            }
        }
    }

    // =========================================================================
    // Garbage Collection & Memory Management
    // =========================================================================

    /**
     * Get memory statistics
     */
    getStats(): {
        tasksInMemory: number;
        runningTasks: number;
        archivedTasks: number;
        notificationQueues: number;
        pendingParents: number;
    } {
        return {
            tasksInMemory: this.tasks.size,
            runningTasks: this.getRunning().length,
            archivedTasks: this.archivedCount,
            notificationQueues: this.notifications.size,
            pendingParents: this.pendingByParent.size,
        };
    }

    /**
     * Garbage collect completed tasks
     * Archives old completed tasks to disk
     */
    async gc(): Promise<number> {
        const now = Date.now();
        const toRemove: string[] = [];
        const toArchive: ParallelTask[] = [];

        for (const [id, task] of this.tasks) {
            // Skip running tasks
            if (task.status === TASK_STATUS.RUNNING) continue;

            const completedAt = task.completedAt?.getTime() ?? 0;
            const age = now - completedAt;

            // Archive tasks older than ARCHIVE_AGE_MS
            if (age > MEMORY_LIMITS.ARCHIVE_AGE_MS && task.status === TASK_STATUS.COMPLETED) {
                toArchive.push(task);
                toRemove.push(id);
            }
            // Remove failed/cancelled tasks older than ERROR_CLEANUP_AGE_MS
            else if (age > MEMORY_LIMITS.ERROR_CLEANUP_AGE_MS && (task.status === TASK_STATUS.ERROR || task.status === TASK_STATUS.CANCELLED)) {
                toRemove.push(id);
            }
        }

        // Archive to disk
        if (toArchive.length > 0) {
            await this.archiveTasks(toArchive);
        }

        // Remove from memory
        for (const id of toRemove) {
            this.tasks.delete(id);
        }

        return toRemove.length;
    }

    /**
     * Archive tasks to disk for later analysis
     */
    private async archiveTasks(tasks: ParallelTask[]): Promise<void> {
        try {
            await fs.mkdir(PATHS.TASK_ARCHIVE, { recursive: true });

            const date = new Date().toISOString().slice(0, 10);
            const filename = `tasks_${date}.jsonl`;
            const filepath = path.join(PATHS.TASK_ARCHIVE, filename);

            const lines = tasks.map(task => JSON.stringify({
                id: task.id,
                agent: task.agent,
                prompt: task.prompt.slice(0, 200), // Truncate
                status: task.status,
                startedAt: task.startedAt,
                completedAt: task.completedAt,
                parentSessionID: task.parentSessionID,
            }));

            await fs.appendFile(filepath, lines.join("\n") + "\n");
            this.archivedCount += tasks.length;
        } catch (error) {
            // Silently fail - archiving is best-effort (no console output to prevent TUI corruption)
        }
    }

    /**
     * Force cleanup of all completed tasks
     */
    forceCleanup(): number {
        const toRemove: string[] = [];

        for (const [id, task] of this.tasks) {
            if (task.status !== "running") {
                toRemove.push(id);
            }
        }

        for (const id of toRemove) {
            this.tasks.delete(id);
        }

        return toRemove.length;
    }
}

