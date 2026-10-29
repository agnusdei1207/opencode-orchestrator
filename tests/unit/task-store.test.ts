/**
 * Task Store Tests
 *
 * Tests for:
 * - Basic CRUD operations and session index
 * - Pending tracking
 * - Notification queue management
 * - clearNotificationsForTask
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TaskStore } from "../../src/core/agents/task-store";
import { MEMORY_LIMITS, TASK_STATUS, type ParallelTask } from "../../src/shared";

function createMockTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: `task_${Math.random().toString(36).slice(2, 10)}`,
        sessionID: `session_${Math.random().toString(36).slice(2, 10)}`,
        parentSessionID: "parent_123",
        description: "Test task",
        prompt: "Test prompt content",
        agent: "builder",
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(),
        depth: 1,
        ...overrides,
    };
}

let store: TaskStore;

beforeEach(() => {
    store = new TaskStore();
});

describe("basic CRUD", () => {
    it("should store and retrieve task", () => {
        const task = createMockTask({ id: "task_1" });
        store.set("task_1", task);

        expect(store.get("task_1")).toBe(task);
        expect(store.getBySession(task.sessionID)).toBe(task);
    });

    it("should delete task and its session index", () => {
        const task = createMockTask({ id: "task_1" });
        store.set("task_1", task);
        expect(store.delete("task_1")).toBe(true);

        expect(store.get("task_1")).toBeUndefined();
        expect(store.getBySession(task.sessionID)).toBeUndefined();
        expect(store.delete("task_1")).toBe(false);
    });

    it("drops the old session index when a task is replaced with a new session", () => {
        const original = createMockTask({ id: "task_1", sessionID: "session_old" });
        store.set("task_1", original);
        const replacement = createMockTask({ id: "task_1", sessionID: "session_new" });
        store.set("task_1", replacement);

        expect(store.getBySession("session_old")).toBeUndefined();
        expect(store.getBySession("session_new")).toBe(replacement);
    });
});

describe("task queries", () => {
    it("should get all tasks", () => {
        store.set("task_1", createMockTask({ id: "task_1" }));
        store.set("task_2", createMockTask({ id: "task_2" }));

        expect(store.getAll()).toHaveLength(2);
    });

    it("should get running and pending tasks", () => {
        store.set("task_1", createMockTask({ id: "task_1", status: TASK_STATUS.RUNNING }));
        store.set("task_2", createMockTask({ id: "task_2", status: TASK_STATUS.PENDING }));
        store.set("task_3", createMockTask({ id: "task_3", status: TASK_STATUS.COMPLETED }));
        store.set("task_4", createMockTask({ id: "task_4", status: TASK_STATUS.FAILED }));

        const active = store.getRunning();
        expect(active).toHaveLength(2);
        expect(active.map(t => t.id)).toContain("task_1");
        expect(active.map(t => t.id)).toContain("task_2");
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

describe("pending tracking", () => {
    it("should track pending task", () => {
        store.trackPending("parent_1", "task_1");
        expect(store.getPendingCount("parent_1")).toBe(1);
    });

    it("counts a task once even when tracked twice", () => {
        store.trackPending("parent_1", "task_1");
        store.trackPending("parent_1", "task_1");
        expect(store.getPendingCount("parent_1")).toBe(1);
    });

    it("should untrack pending task", () => {
        store.trackPending("parent_1", "task_1");
        store.untrackPending("parent_1", "task_1");

        expect(store.getPendingCount("parent_1")).toBe(0);
    });

    it("should handle multiple pending tasks", () => {
        store.trackPending("parent_1", "task_1");
        store.trackPending("parent_1", "task_2");

        expect(store.getPendingCount("parent_1")).toBe(2);

        store.untrackPending("parent_1", "task_1");
        expect(store.getPendingCount("parent_1")).toBe(1);
    });
});

describe("notification queue", () => {
    it("should queue a snapshot of the task", () => {
        const task = createMockTask({ parentSessionID: "parent_1", status: TASK_STATUS.COMPLETED });
        store.queueNotification(task);
        task.status = TASK_STATUS.PENDING;

        const notifications = store.getNotifications("parent_1");
        expect(notifications).toHaveLength(1);
        expect(notifications[0].status).toBe(TASK_STATUS.COMPLETED);
    });

    it("keeps only the newest notices per parent", () => {
        const limit = MEMORY_LIMITS.MAX_NOTIFICATIONS_PER_PARENT;
        for (let i = 0; i < limit + 2; i++) {
            store.queueNotification(createMockTask({ id: `task_${i}`, parentSessionID: "parent_1" }));
        }

        const notifications = store.getNotifications("parent_1");
        expect(notifications).toHaveLength(limit);
        expect(notifications[0].id).toBe("task_2");
        expect(notifications.at(-1)?.id).toBe(`task_${limit + 1}`);
    });

    it("acknowledges only the delivered notices", () => {
        store.queueNotification(createMockTask({ id: "task_1", parentSessionID: "parent_1" }));
        const delivered = store.getNotifications("parent_1");
        store.queueNotification(createMockTask({ id: "task_2", parentSessionID: "parent_1" }));

        store.acknowledgeNotifications("parent_1", delivered);

        expect(store.getNotifications("parent_1").map(t => t.id)).toEqual(["task_2"]);
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
});
