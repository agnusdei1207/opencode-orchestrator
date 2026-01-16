/**
 * Task Store Tests
 * 
 * Tests for:
 * - Basic CRUD operations
 * - Pending tracking
 * - Notification queue management
 * - clearNotificationsForTask
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TaskStore } from "../../src/core/agents/task-store";
import type { ParallelTask } from "../../src/core/agents/interfaces/parallel-task";

function createMockTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: `task_${Math.random().toString(36).slice(2, 10)}`,
        sessionID: `session_${Math.random().toString(36).slice(2, 10)}`,
        parentSessionID: "parent_123",
        description: "Test task",
        agent: "builder",
        status: "running",
        startedAt: new Date(),
        ...overrides,
    };
}

describe("TaskStore", () => {
    let store: TaskStore;

    beforeEach(() => {
        store = new TaskStore();
    });

    // ========================================================================
    // Basic CRUD
    // ========================================================================

    describe("basic CRUD", () => {
        it("should store and retrieve task", () => {
            const task = createMockTask({ id: "task_1" });
            store.set("task_1", task);

            expect(store.get("task_1")).toBe(task);
        });

        it("should delete task", () => {
            const task = createMockTask({ id: "task_1" });
            store.set("task_1", task);
            store.delete("task_1");

            expect(store.get("task_1")).toBeUndefined();
        });

        it("should get all tasks", () => {
            store.set("task_1", createMockTask({ id: "task_1" }));
            store.set("task_2", createMockTask({ id: "task_2" }));

            expect(store.getAll()).toHaveLength(2);
        });

        it("should get running tasks only", () => {
            store.set("task_1", createMockTask({ id: "task_1", status: "running" }));
            store.set("task_2", createMockTask({ id: "task_2", status: "completed" }));

            const running = store.getRunning();
            expect(running).toHaveLength(1);
            expect(running[0].id).toBe("task_1");
        });

        it("should get tasks by parent", () => {
            store.set("task_1", createMockTask({ id: "task_1", parentSessionID: "parent_a" }));
            store.set("task_2", createMockTask({ id: "task_2", parentSessionID: "parent_b" }));

            const tasks = store.getByParent("parent_a");
            expect(tasks).toHaveLength(1);
            expect(tasks[0].id).toBe("task_1");
        });

        it("should clear all", () => {
            store.set("task_1", createMockTask({ id: "task_1" }));
            store.trackPending("parent_1", "task_1");
            store.queueNotification(createMockTask({ id: "task_2", parentSessionID: "parent_1" }));

            store.clear();

            expect(store.getAll()).toHaveLength(0);
            expect(store.getPendingCount("parent_1")).toBe(0);
            expect(store.getNotifications("parent_1")).toHaveLength(0);
        });
    });

    // ========================================================================
    // Pending Tracking
    // ========================================================================

    describe("pending tracking", () => {
        it("should track pending task", () => {
            store.trackPending("parent_1", "task_1");
            expect(store.getPendingCount("parent_1")).toBe(1);
            expect(store.hasPending("parent_1")).toBe(true);
        });

        it("should untrack pending task", () => {
            store.trackPending("parent_1", "task_1");
            store.untrackPending("parent_1", "task_1");

            expect(store.getPendingCount("parent_1")).toBe(0);
            expect(store.hasPending("parent_1")).toBe(false);
        });

        it("should handle multiple pending tasks", () => {
            store.trackPending("parent_1", "task_1");
            store.trackPending("parent_1", "task_2");

            expect(store.getPendingCount("parent_1")).toBe(2);

            store.untrackPending("parent_1", "task_1");
            expect(store.getPendingCount("parent_1")).toBe(1);
        });
    });

    // ========================================================================
    // Notification Queue
    // ========================================================================

    describe("notification queue", () => {
        it("should queue notification", () => {
            const task = createMockTask({ parentSessionID: "parent_1" });
            store.queueNotification(task);

            expect(store.getNotifications("parent_1")).toHaveLength(1);
        });

        it("should clear notifications for session", () => {
            store.queueNotification(createMockTask({ parentSessionID: "parent_1" }));
            store.clearNotifications("parent_1");

            expect(store.getNotifications("parent_1")).toHaveLength(0);
        });

        it("should clear notifications for specific task", () => {
            const task1 = createMockTask({ id: "task_1", parentSessionID: "parent_1" });
            const task2 = createMockTask({ id: "task_2", parentSessionID: "parent_1" });

            store.queueNotification(task1);
            store.queueNotification(task2);

            store.clearNotificationsForTask("task_1");

            const notifications = store.getNotifications("parent_1");
            expect(notifications).toHaveLength(1);
            expect(notifications[0].id).toBe("task_2");
        });

        it("should clean empty notification queues", () => {
            const task = createMockTask({ parentSessionID: "parent_1" });
            store.queueNotification(task);
            store.clearNotificationsForTask(task.id);

            store.cleanEmptyNotifications();

            // Internal state should be cleaned
            expect(store.getNotifications("parent_1")).toHaveLength(0);
        });
    });
});
