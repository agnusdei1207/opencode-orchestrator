/**
 * Task Store - in-memory delegated tasks, pending counts and parent notices.
 *
 * Every task that ends schedules its own cleanup (TaskCleaner), which deletes
 * it from here, so the store does not need its own garbage collection.
 */

import type { ParallelTask } from "../../shared/index.js";
import { MEMORY_LIMITS, TASK_STATUS } from "../../shared/index.js";

export class TaskStore {
    private tasks: Map<string, ParallelTask> = new Map();
    private taskIdsBySession: Map<string, string> = new Map();
    private pendingByParent: Map<string, Set<string>> = new Map();
    private notifications: Map<string, ParallelTask[]> = new Map();

    set(id: string, task: ParallelTask): void {
        const existing = this.tasks.get(id);
        if (existing && existing.sessionID !== task.sessionID) {
            this.taskIdsBySession.delete(existing.sessionID);
        }
        this.tasks.set(id, task);
        this.taskIdsBySession.set(task.sessionID, id);
    }

    get(id: string): ParallelTask | undefined {
        return this.tasks.get(id);
    }

    getAll(): ParallelTask[] {
        return Array.from(this.tasks.values());
    }

    getBySession(sessionID: string): ParallelTask | undefined {
        const taskId = this.taskIdsBySession.get(sessionID);
        return taskId ? this.tasks.get(taskId) : undefined;
    }

    getRunning(): ParallelTask[] {
        return this.getAll().filter(t => t.status === TASK_STATUS.RUNNING || t.status === TASK_STATUS.PENDING);
    }

    getByParent(parentSessionID: string): ParallelTask[] {
        return this.getAll().filter(t => t.parentSessionID === parentSessionID);
    }

    delete(id: string): boolean {
        const task = this.tasks.get(id);
        if (!task) return false;
        this.taskIdsBySession.delete(task.sessionID);
        this.tasks.delete(id);
        return true;
    }

    clear(): void {
        this.tasks.clear();
        this.taskIdsBySession.clear();
        this.pendingByParent.clear();
        this.notifications.clear();
    }

    trackPending(parentSessionID: string, taskId: string): void {
        const pending = this.pendingByParent.get(parentSessionID) ?? new Set();
        pending.add(taskId);
        this.pendingByParent.set(parentSessionID, pending);
    }

    untrackPending(parentSessionID: string, taskId: string): void {
        const pending = this.pendingByParent.get(parentSessionID);
        if (!pending) return;
        pending.delete(taskId);
        if (pending.size === 0) this.pendingByParent.delete(parentSessionID);
    }

    getPendingCount(parentSessionID: string): number {
        return this.pendingByParent.get(parentSessionID)?.size ?? 0;
    }

    /** Queue a snapshot of the task for its parent, keeping the newest notices. */
    queueNotification(task: ParallelTask): void {
        const queue = this.notifications.get(task.parentSessionID) ?? [];
        queue.push({ ...task });
        if (queue.length > MEMORY_LIMITS.MAX_NOTIFICATIONS_PER_PARENT) queue.shift();
        this.notifications.set(task.parentSessionID, queue);
    }

    getNotifications(parentSessionID: string): ParallelTask[] {
        return [...(this.notifications.get(parentSessionID) ?? [])];
    }

    acknowledgeNotifications(parentSessionID: string, delivered: ParallelTask[]): void {
        const remaining = (this.notifications.get(parentSessionID) ?? []).filter(task => !delivered.includes(task));
        if (remaining.length) this.notifications.set(parentSessionID, remaining);
        else this.notifications.delete(parentSessionID);
    }

    clearNotifications(parentSessionID: string): void {
        this.notifications.delete(parentSessionID);
    }

    clearNotificationsForTask(taskId: string): void {
        for (const [sessionID, tasks] of this.notifications.entries()) {
            const filtered = tasks.filter(t => t.id !== taskId);
            if (filtered.length === 0) this.notifications.delete(sessionID);
            else if (filtered.length !== tasks.length) this.notifications.set(sessionID, filtered);
        }
    }
}
