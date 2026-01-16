/**
 * Full System E2E Tests
 * 
 * Comprehensive integration tests:
 * - Concurrency + TaskStore + Events
 * - Background tasks + Session state
 * - Complete workflow simulation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import { ConcurrencyController, type ConcurrencyConfig } from "../../src/core/agents/concurrency";
import { TaskStore } from "../../src/core/agents/task-store";
import { TaskGraph } from "../../src/core/orchestrator/task-graph";
import type { ParallelTask } from "../../src/core/agents/interfaces/parallel-task";
import type { Task } from "../../src/core/orchestrator/interfaces/task";

// ========================================================================
// Helpers
// ========================================================================

function createParallelTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: `task_${Math.random().toString(36).slice(2, 10)}`,
        sessionID: `session_${Math.random().toString(36).slice(2, 10)}`,
        parentSessionID: "orchestrator_session",
        description: "Parallel task",
        agent: "builder",
        status: "running",
        startedAt: new Date(),
        concurrencyKey: "builder",
        ...overrides,
    };
}

function createOrchestratorTask(overrides: Partial<Task> = {}): Task {
    return {
        id: `t${Math.floor(Math.random() * 1000)}`,
        description: "Orchestrator task",
        action: "implement",
        file: "src/test.ts",
        dependencies: [],
        status: "pending",
        retryCount: 0,
        complexity: 3,
        type: "logic",
        ...overrides,
    };
}

describe("Full System E2E", () => {

    // ========================================================================
    // Concurrent Task Execution
    // ========================================================================

    describe("concurrent task execution", () => {
        it("should handle full parallel task workflow", async () => {
            const config: ConcurrencyConfig = {
                agentConcurrency: { builder: 2, inspector: 1 },
                defaultConcurrency: 3,
            };
            const concurrency = new ConcurrencyController(config);
            const store = new TaskStore();

            // === Phase 1: Launch Tasks ===
            const tasks: ParallelTask[] = [];

            for (let i = 0; i < 2; i++) {
                const task = createParallelTask({
                    id: `task_${i}`,
                    agent: "builder",
                    concurrencyKey: "builder",
                });

                await concurrency.acquire(task.concurrencyKey!);
                store.set(task.id, task);
                store.trackPending(task.parentSessionID, task.id);
                tasks.push(task);
            }

            expect(store.getPendingCount("orchestrator_session")).toBe(2);
            expect(concurrency.getActiveCount("builder")).toBe(2);

            // === Phase 2: Complete Tasks ===
            for (const task of tasks) {
                task.status = "completed";
                task.completedAt = new Date();

                if (task.concurrencyKey) {
                    concurrency.release(task.concurrencyKey);
                    task.concurrencyKey = undefined;
                }

                store.untrackPending(task.parentSessionID, task.id);
                store.queueNotification(task);
            }

            // === Phase 3: Verify ===
            expect(store.hasPending("orchestrator_session")).toBe(false);
            expect(store.getNotifications("orchestrator_session")).toHaveLength(2);
            expect(concurrency.getActiveCount("builder")).toBe(0);
        });

        it("should handle mixed agent types with different limits", async () => {
            const config: ConcurrencyConfig = {
                agentConcurrency: { builder: 2, inspector: 1 },
            };
            const concurrency = new ConcurrencyController(config);

            // Launch 2 builder tasks (at limit)
            await concurrency.acquire("builder");
            await concurrency.acquire("builder");
            expect(concurrency.getActiveCount("builder")).toBe(2);

            // Launch 1 inspector task (at limit)
            await concurrency.acquire("inspector");
            expect(concurrency.getActiveCount("inspector")).toBe(1);

            // Try to launch another inspector - should queue
            let inspectorQueued = true;
            const inspectorPromise = concurrency.acquire("inspector").then(() => {
                inspectorQueued = false;
            });

            expect(concurrency.getQueueLength("inspector")).toBe(1);

            // Release inspector slot
            concurrency.release("inspector");
            await inspectorPromise;

            expect(inspectorQueued).toBe(false);
        });
    });

    // ========================================================================
    // Session Event Simulation
    // ========================================================================

    describe("session event handling", () => {
        it("should handle session.deleted event cascade", async () => {
            const concurrency = new ConcurrencyController({ defaultConcurrency: 5 });
            const store = new TaskStore();

            // Setup: 3 running tasks
            const tasks = [];
            for (let i = 0; i < 3; i++) {
                const task = createParallelTask({ id: `task_${i}` });
                await concurrency.acquire(task.concurrencyKey!);
                store.set(task.id, task);
                store.trackPending(task.parentSessionID, task.id);
                tasks.push(task);
            }

            expect(concurrency.getActiveCount("builder")).toBe(3);

            // Simulate session deleted
            const deletedTask = tasks[0];
            const handleSessionDeleted = (sessionID: string) => {
                const task = store.getAll().find((t: ParallelTask) => t.sessionID === sessionID);
                if (!task) return;

                if (task.status === "running") {
                    task.status = "error";
                    task.error = "Session deleted";
                }

                if (task.concurrencyKey) {
                    concurrency.release(task.concurrencyKey);
                    task.concurrencyKey = undefined;
                }

                store.untrackPending(task.parentSessionID, task.id);
                store.clearNotificationsForTask(task.id);
                store.delete(task.id);
            };

            handleSessionDeleted(deletedTask.sessionID);

            expect(store.get(deletedTask.id)).toBeUndefined();
            expect(concurrency.getActiveCount("builder")).toBe(2);
            expect(store.getPendingCount("orchestrator_session")).toBe(2);
        });

        it("should handle session.idle event with stability check", async () => {
            const store = new TaskStore();
            const task = createParallelTask({
                startedAt: new Date(Date.now() - 15000),
                stablePolls: 3,
            });
            store.set(task.id, task);

            const MIN_STABILITY_MS = 10000;
            const elapsed = Date.now() - task.startedAt.getTime();
            const isStable = (task.stablePolls ?? 0) >= 3;
            const meetsMinTime = elapsed >= MIN_STABILITY_MS;

            if (isStable && meetsMinTime) {
                task.status = "completed";
                task.completedAt = new Date();
            }

            expect(task.status).toBe("completed");
        });
    });

    // ========================================================================
    // Orchestrator + Parallel Integration
    // ========================================================================

    describe("orchestrator + parallel integration", () => {
        it("should execute DAG tasks with parallel agents", async () => {
            const graph = new TaskGraph();
            const concurrency = new ConcurrencyController({ defaultConcurrency: 3 });

            // Setup DAG: t1 → t2, t3 → t4
            graph.addTask(createOrchestratorTask({ id: "t1", dependencies: [] }));
            graph.addTask(createOrchestratorTask({ id: "t2", dependencies: ["t1"] }));
            graph.addTask(createOrchestratorTask({ id: "t3", dependencies: ["t1"] }));
            graph.addTask(createOrchestratorTask({ id: "t4", dependencies: ["t2", "t3"] }));

            // Wave 1: t1
            let readyTasks = graph.getReadyTasks();
            expect(readyTasks.map((t: Task) => t.id)).toEqual(["t1"]);

            await concurrency.acquire("builder");
            graph.updateTask("t1", { status: "completed" });
            concurrency.release("builder");

            // Wave 2: t2, t3 (parallel)
            readyTasks = graph.getReadyTasks();
            expect(readyTasks.map((t: Task) => t.id).sort()).toEqual(["t2", "t3"]);

            await concurrency.acquire("builder");
            await concurrency.acquire("builder");
            graph.updateTask("t2", { status: "completed" });
            graph.updateTask("t3", { status: "completed" });
            concurrency.release("builder");
            concurrency.release("builder");

            // Wave 3: t4
            readyTasks = graph.getReadyTasks();
            expect(readyTasks.map((t: Task) => t.id)).toEqual(["t4"]);

            graph.updateTask("t4", { status: "completed" });

            expect(graph.isCompleted()).toBe(true);
        });

        it("should handle task failure and stop dependent tasks", () => {
            const graph = new TaskGraph();

            graph.addTask(createOrchestratorTask({ id: "t1", dependencies: [] }));
            graph.addTask(createOrchestratorTask({ id: "t2", dependencies: ["t1"] }));

            // Fail t1 with max retries
            graph.updateTask("t1", { status: "failed", retryCount: 3 });

            expect(graph.hasFailed()).toBe(true);

            const readyTasks = graph.getReadyTasks();
            expect(readyTasks.map((t: Task) => t.id)).not.toContain("t2");
        });
    });

    // ========================================================================
    // Resource Cleanup
    // ========================================================================

    describe("resource cleanup", () => {
        it("should cleanup all resources after workflow", async () => {
            const concurrency = new ConcurrencyController({ defaultConcurrency: 5 });
            const store = new TaskStore();

            for (let i = 0; i < 5; i++) {
                const task = createParallelTask({ id: `task_${i}` });
                await concurrency.acquire(task.concurrencyKey!);
                store.set(task.id, task);
                store.trackPending(task.parentSessionID, task.id);
            }

            expect(concurrency.getActiveCount("builder")).toBe(5);
            expect(store.getPendingCount("orchestrator_session")).toBe(5);

            for (const task of store.getAll()) {
                if (task.concurrencyKey) {
                    concurrency.release(task.concurrencyKey);
                    task.concurrencyKey = undefined;
                }
                store.untrackPending(task.parentSessionID, task.id);
            }
            store.clear();

            expect(concurrency.getActiveCount("builder")).toBe(0);
            expect(store.getAll()).toHaveLength(0);
        });

        it("should not leak concurrency slots on error", async () => {
            const concurrency = new ConcurrencyController({ defaultConcurrency: 2 });

            await concurrency.acquire("builder");
            expect(concurrency.getActiveCount("builder")).toBe(1);

            try {
                throw new Error("Task failed");
            } catch {
                concurrency.release("builder");
            }

            expect(concurrency.getActiveCount("builder")).toBe(0);
        });
    });
});
