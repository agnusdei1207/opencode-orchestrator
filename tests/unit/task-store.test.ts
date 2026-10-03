/**
 * Task Store Tests
 * 
 * Tests for:
 * - Basic CRUD operations
 * - Pending tracking
 * - Notification queue management
 * - clearNotificationsForTask
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TaskStore } from "../../src/core/agents/task-store";
import { acquireParallelTask, taskPool } from "../../src/core/pool/task-pool";
import { MEMORY_LIMITS, PATHS, TASK_STATUS, type ParallelTask } from "../../src/shared";

vi.mock("node:fs/promises", async importOriginal => ({
    ...await importOriginal<typeof import("node:fs/promises")>(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
}));

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
    vi.clearAllMocks();
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

    it("stops tracking a pooled task once it is deleted", () => {
        const before = taskPool.getStats().inUse;
        const task = acquireParallelTask({
            id: "pooled_1",
            sessionID: "pooled_session",
            parentSessionID: "parent_123",
            description: "Pooled task",
            prompt: "Pooled prompt",
            agent: "worker",
            depth: 1,
        });
        store.set(task.id, task);
        expect(taskPool.getStats().inUse).toBe(before + 1);

        store.delete(task.id);

        expect(taskPool.getStats().inUse).toBe(before);
        // Callers may still hold the object, so it must keep its data.
        expect(task.prompt).toBe("Pooled prompt");
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

// ========================================================================
// Garbage Collection & Memory Management
// ========================================================================

describe("garbage collection races", () => {
    it.each(["resumed", "replaced", "completed again"])("preserves a task %s during archive I/O", async change => {
        const task = createMockTask({ id: "race", status: TASK_STATUS.COMPLETED,
            completedAt: new Date(Date.now() - 3_600_000) });
        store.set(task.id, task);
        let finishArchive!: () => void;
        vi.mocked(fs.mkdir).mockImplementationOnce(() => new Promise(resolve => {
            finishArchive = () => resolve(undefined);
        }));
        const collecting = store.gc();
        const current = change === "replaced" ? { ...task } : task;
        if (change !== "replaced") current.startedAt = new Date();
        if (change === "resumed") current.status = TASK_STATUS.PENDING;
        store.set("race", current);
        finishArchive();
        expect(await collecting).toBe(0);
        expect(store.get("race")).toBe(current);
        expect(store.getBySession(current.sessionID)).toBe(current);
        const archived = JSON.parse(String(vi.mocked(fs.appendFile).mock.calls[0][1]));
        expect(archived.status).toBe(TASK_STATUS.COMPLETED);
    });

    it("runs a single garbage collection when inserts overlap an in-flight archive", async () => {
        const completedAt = new Date(Date.now() - 3_600_000);
        for (let i = 0; i < MEMORY_LIMITS.MAX_TASKS_IN_MEMORY; i++) {
            store.set(`old_${i}`, createMockTask({ id: `old_${i}`, status: TASK_STATUS.COMPLETED, completedAt }));
        }
        let finishArchive!: () => void;
        vi.mocked(fs.mkdir).mockImplementationOnce(() => new Promise(resolve => {
            finishArchive = () => resolve(undefined);
        }));
        store.set("over_1", createMockTask({ id: "over_1" }));
        store.set("over_2", createMockTask({ id: "over_2" }));
        const pending = store.gc();
        finishArchive();
        await pending;

        expect(fs.appendFile).toHaveBeenCalledTimes(1);
        expect(store.getStats().archivedTasks).toBe(MEMORY_LIMITS.MAX_TASKS_IN_MEMORY);
    });
});

describe("garbage collection archive location", () => {
    it("archives only under the plugin project directory", async () => {
        const directory = path.resolve("separate-plugin-project");
        store = new TaskStore(directory);
        store.set("archived", createMockTask({ id: "archived", status: TASK_STATUS.COMPLETED,
            completedAt: new Date(Date.now() - 3_600_000) }));
        await store.gc();
        expect(fs.mkdir).toHaveBeenCalledExactlyOnceWith(path.join(directory, PATHS.TASK_ARCHIVE), { recursive: true });
        expect(fs.appendFile).toHaveBeenCalledExactlyOnceWith(
            path.join(directory, PATHS.TASK_ARCHIVE, `tasks_${new Date().toISOString().slice(0, 10)}.jsonl`),
            expect.stringContaining('"id":"archived"'),
        );
    });
});

describe("memory statistics and collection results", () => {
    it("returns accurate memory statistics", () => {
        store.set("t1", createMockTask({ id: "t1", status: TASK_STATUS.RUNNING }));
        store.trackPending("p1", "t1");
        store.queueNotification(createMockTask({ id: "t2", parentSessionID: "p1" }));

        const stats = store.getStats();
        expect(stats.tasksInMemory).toBe(1);
        expect(stats.runningTasks).toBe(1);
        expect(stats.notificationQueues).toBe(1);
        expect(stats.pendingParents).toBe(1);
    });

    it("gc archives old completed tasks and removes old errored tasks", async () => {
        const oldDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
        store.set("t_old_comp", createMockTask({
            id: "t_old_comp",
            status: TASK_STATUS.COMPLETED,
            completedAt: oldDate,
        }));
        store.set("t_old_err", createMockTask({
            id: "t_old_err",
            status: TASK_STATUS.ERROR,
            completedAt: oldDate,
        }));
        store.set("t_running", createMockTask({
            id: "t_running",
            status: TASK_STATUS.RUNNING,
        }));

        const removed = await store.gc();
        expect(removed).toBe(2);
        expect(store.get("t_running")).toBeDefined();
        expect(store.get("t_old_comp")).toBeUndefined();
        expect(store.get("t_old_err")).toBeUndefined();
    });

    it("returns pool stats", () => {
        const poolStats = store.getPoolStats();
        expect(poolStats.taskPool).toBeDefined();
        expect(poolStats.stringPool).toBeDefined();
    });
});
