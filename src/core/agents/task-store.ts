/**
 * Task Store - Stores and manages parallel tasks
 */

import type { ParallelTask } from "./interfaces/parallel-task.js";

export class TaskStore {
    private tasks: Map<string, ParallelTask> = new Map();
    private pendingByParent: Map<string, Set<string>> = new Map();
    private notifications: Map<string, ParallelTask[]> = new Map();

    set(id: string, task: ParallelTask): void {
        this.tasks.set(id, task);
    }

    get(id: string): ParallelTask | undefined {
        return this.tasks.get(id);
    }

    getAll(): ParallelTask[] {
        return Array.from(this.tasks.values());
    }

    getRunning(): ParallelTask[] {
        return this.getAll().filter(t => t.status === "running");
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

    // Notifications
    queueNotification(task: ParallelTask): void {
        const queue = this.notifications.get(task.parentSessionID) ?? [];
        queue.push(task);
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

    /**
     * Remove a specific task from all notification queues
     */
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
}
