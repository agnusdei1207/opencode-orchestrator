/**
 * Integration Tests
 * 
 * End-to-end tests for:
 * - Full task lifecycle
 * - Event handling integration
 * - Concurrency with multiple tasks
 * - Resource cleanup
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import type { ParallelTask } from "../../src/core/agents/interfaces/parallel-task";

function createMockTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: `task_${Math.random().toString(36).slice(2, 10)}`,
        sessionID: `session_${Math.random().toString(36).slice(2, 10)}`,
        parentSessionID: "parent_main",
        description: "Integration test task",
        agent: "builder",
        status: "running",
        startedAt: new Date(),
        concurrencyKey: "builder",
        ...overrides,
    };
}

describe("Integration Tests", () => {
    let store: TaskStore;
    let concurrency: ConcurrencyController;

    beforeEach(() => {
        store = new TaskStore();
        concurrency = new ConcurrencyController({ defaultConcurrency: 2 });
    });

    // ========================================================================
    // Full Task Lifecycle
    // ========================================================================

    describe("full task lifecycle", () => {
        it("should handle complete task lifecycle", async () => {
            // 1. Create and launch task
            const task = createMockTask();
            await concurrency.acquire(task.concurrencyKey!);
            store.set(task.id, task);
            store.trackPending(task.parentSessionID, task.id);

            expect(store.get(task.id)).toBeDefined();
            expect(store.hasPending(task.parentSessionID)).toBe(true);
            expect(concurrency.getActiveCount("builder")).toBe(1);

            // 2. Task completes
            task.status = "completed";
            task.completedAt = new Date();

            if (task.concurrencyKey) {
                concurrency.release(task.concurrencyKey);
                task.concurrencyKey = undefined;
            }

            store.untrackPending(task.parentSessionID, task.id);
            store.queueNotification(task);

            expect(task.status).toBe("completed");
            expect(concurrency.getActiveCount("builder")).toBe(0);
            expect(store.hasPending(task.parentSessionID)).toBe(false);
            expect(store.getNotifications(task.parentSessionID)).toHaveLength(1);

            // 3. Cleanup
            store.clearNotifications(task.parentSessionID);
            store.delete(task.id);

            expect(store.get(task.id)).toBeUndefined();
            expect(store.getNotifications(task.parentSessionID)).toHaveLength(0);
        });
    });

    // ========================================================================
    // Concurrent Tasks
    // ========================================================================

    describe("concurrent tasks", () => {
        it("should handle multiple concurrent tasks", async () => {
            const task1 = createMockTask({ id: "task_1", concurrencyKey: "builder" });
            const task2 = createMockTask({ id: "task_2", concurrencyKey: "builder" });

            // Launch both tasks
            await concurrency.acquire(task1.concurrencyKey!);
            await concurrency.acquire(task2.concurrencyKey!);

            store.set(task1.id, task1);
            store.set(task2.id, task2);
            store.trackPending(task1.parentSessionID, task1.id);
            store.trackPending(task2.parentSessionID, task2.id);

            expect(concurrency.getActiveCount("builder")).toBe(2);
            expect(store.getPendingCount(task1.parentSessionID)).toBe(2);

            // Complete first task
            task1.status = "completed";
            if (task1.concurrencyKey) {
                concurrency.release(task1.concurrencyKey);
                task1.concurrencyKey = undefined;
            }
            store.untrackPending(task1.parentSessionID, task1.id);

            expect(concurrency.getActiveCount("builder")).toBe(1);
            expect(store.getPendingCount(task1.parentSessionID)).toBe(1);

            // Complete second task
            task2.status = "completed";
            if (task2.concurrencyKey) {
                concurrency.release(task2.concurrencyKey);
                task2.concurrencyKey = undefined;
            }
            store.untrackPending(task2.parentSessionID, task2.id);

            expect(concurrency.getActiveCount("builder")).toBe(0);
            expect(store.getPendingCount(task1.parentSessionID)).toBe(0);
        });

        it("should queue tasks when at concurrency limit", async () => {
            concurrency = new ConcurrencyController({ defaultConcurrency: 1 });

            // First task acquires slot
            await concurrency.acquire("builder");
            expect(concurrency.getActiveCount("builder")).toBe(1);

            // Second task should be queued
            let secondAcquired = false;
            const acquirePromise = concurrency.acquire("builder").then(() => {
                secondAcquired = true;
            });

            expect(secondAcquired).toBe(false);
            expect(concurrency.getQueueLength("builder")).toBe(1);

            // Release first, second should proceed
            concurrency.release("builder");
            await acquirePromise;

            expect(secondAcquired).toBe(true);
        });
    });

    // ========================================================================
    // Event Handling Integration
    // ========================================================================

    describe("event handling integration", () => {
        it("should cleanup on session.deleted event", async () => {
            const task = createMockTask();
            await concurrency.acquire(task.concurrencyKey!);
            store.set(task.id, task);
            store.trackPending(task.parentSessionID, task.id);

            // Simulate session.deleted event
            const handleSessionDeleted = (sessionID: string) => {
                const foundTask = store.getAll().find(t => t.sessionID === sessionID);
                if (!foundTask) return;

                if (foundTask.status === "running") {
                    foundTask.status = "error";
                    foundTask.error = "Session deleted";
                    foundTask.completedAt = new Date();
                }

                if (foundTask.concurrencyKey) {
                    concurrency.release(foundTask.concurrencyKey);
                    foundTask.concurrencyKey = undefined;
                }

                store.untrackPending(foundTask.parentSessionID, foundTask.id);
                store.delete(foundTask.id);
            };

            handleSessionDeleted(task.sessionID);

            expect(store.get(task.id)).toBeUndefined();
            expect(concurrency.getActiveCount("builder")).toBe(0);
            expect(store.hasPending(task.parentSessionID)).toBe(false);
        });
    });

    // ========================================================================
    // Resource Cleanup
    // ========================================================================

    describe("resource cleanup", () => {
        it("should clean up all resources on clear()", async () => {
            // Use higher concurrency to avoid blocking
            const localConcurrency = new ConcurrencyController({ defaultConcurrency: 10 });

            // Setup multiple tasks
            for (let i = 0; i < 3; i++) {
                const task = createMockTask({ id: `task_${i}` });
                await localConcurrency.acquire(task.concurrencyKey!);
                store.set(task.id, task);
                store.trackPending(task.parentSessionID, task.id);
                store.queueNotification(task);
            }

            expect(store.getAll()).toHaveLength(3);
            expect(store.getPendingCount("parent_main")).toBe(3);

            // Clear all
            store.clear();

            expect(store.getAll()).toHaveLength(0);
            expect(store.getPendingCount("parent_main")).toBe(0);
            expect(store.getNotifications("parent_main")).toHaveLength(0);
        });

        it("should handle notification cleanup for specific task", () => {
            const task1 = createMockTask({ id: "task_1" });
            const task2 = createMockTask({ id: "task_2" });

            store.queueNotification(task1);
            store.queueNotification(task2);

            expect(store.getNotifications("parent_main")).toHaveLength(2);

            store.clearNotificationsForTask("task_1");

            const remaining = store.getNotifications("parent_main");
            expect(remaining).toHaveLength(1);
            expect(remaining[0].id).toBe("task_2");
        });
    });
});
