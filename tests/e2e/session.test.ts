/**
 * Session & TaskGraph E2E Tests
 * 
 * Tests for:
 * - Task graph DAG operations
 * - Task state transitions
 * - Dependency resolution
 * - Completion detection
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TaskGraph } from "../../src/core/orchestrator/task-graph";
import { TaskStore } from "../../src/core/agents/task-store";
import type { Task } from "../../src/core/orchestrator/interfaces/task";

function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: `t${Math.floor(Math.random() * 1000)}`,
        description: "Test task",
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

describe("TaskGraph E2E", () => {
    let graph: TaskGraph;

    beforeEach(() => {
        graph = new TaskGraph();
    });

    // ========================================================================
    // Task Addition
    // ========================================================================

    describe("task addition", () => {
        it("should add task to graph", () => {
            const task = createTask({ id: "t1" });
            graph.addTask(task);

            const retrieved = graph.getTask("t1");
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe("t1");
        });

        it("should handle multiple tasks", () => {
            graph.addTask(createTask({ id: "t1" }));
            graph.addTask(createTask({ id: "t2" }));
            graph.addTask(createTask({ id: "t3" }));

            expect(graph.getTask("t1")).toBeDefined();
            expect(graph.getTask("t2")).toBeDefined();
            expect(graph.getTask("t3")).toBeDefined();
        });

        it("should reset status to pending on add", () => {
            const task = createTask({ id: "t1", status: "completed" });
            graph.addTask(task);

            expect(graph.getTask("t1")?.status).toBe("pending");
        });
    });

    // ========================================================================
    // Dependency Resolution
    // ========================================================================

    describe("dependency resolution", () => {
        it("should get ready tasks (no dependencies)", () => {
            graph.addTask(createTask({ id: "t1", dependencies: [] }));
            graph.addTask(createTask({ id: "t2", dependencies: ["t1"] }));

            const ready = graph.getReadyTasks();
            expect(ready).toHaveLength(1);
            expect(ready[0].id).toBe("t1");
        });

        it("should unlock dependent tasks when dependency completes", () => {
            graph.addTask(createTask({ id: "t1", dependencies: [] }));
            graph.addTask(createTask({ id: "t2", dependencies: ["t1"] }));

            // Complete t1
            graph.updateTask("t1", { status: "completed" });

            const ready = graph.getReadyTasks();
            expect(ready.some((t: Task) => t.id === "t2")).toBe(true);
        });

        it("should handle chain of dependencies", () => {
            graph.addTask(createTask({ id: "t1", dependencies: [] }));
            graph.addTask(createTask({ id: "t2", dependencies: ["t1"] }));
            graph.addTask(createTask({ id: "t3", dependencies: ["t2"] }));

            // Initially only t1 is ready
            expect(graph.getReadyTasks().map((t: Task) => t.id)).toEqual(["t1"]);

            // Complete t1 → t2 becomes ready
            graph.updateTask("t1", { status: "completed" });
            expect(graph.getReadyTasks().map((t: Task) => t.id)).toEqual(["t2"]);

            // Complete t2 → t3 becomes ready
            graph.updateTask("t2", { status: "completed" });
            expect(graph.getReadyTasks().map((t: Task) => t.id)).toEqual(["t3"]);
        });

        it("should handle multiple dependencies (fan-in)", () => {
            graph.addTask(createTask({ id: "t1", dependencies: [] }));
            graph.addTask(createTask({ id: "t2", dependencies: [] }));
            graph.addTask(createTask({ id: "t3", dependencies: ["t1", "t2"] }));

            // t1 and t2 are ready, t3 is not
            const ready = graph.getReadyTasks();
            expect(ready.map((t: Task) => t.id).sort()).toEqual(["t1", "t2"]);

            // Complete only t1 → t3 still not ready
            graph.updateTask("t1", { status: "completed" });
            expect(graph.getReadyTasks().map((t: Task) => t.id)).toEqual(["t2"]);

            // Complete t2 → t3 becomes ready
            graph.updateTask("t2", { status: "completed" });
            expect(graph.getReadyTasks().map((t: Task) => t.id)).toEqual(["t3"]);
        });
    });

    // ========================================================================
    // Completion Detection
    // ========================================================================

    describe("completion detection", () => {
        it("should detect all completed", () => {
            graph.addTask(createTask({ id: "t1" }));
            graph.addTask(createTask({ id: "t2" }));

            expect(graph.isCompleted()).toBe(false);

            graph.updateTask("t1", { status: "completed" });
            expect(graph.isCompleted()).toBe(false);

            graph.updateTask("t2", { status: "completed" });
            expect(graph.isCompleted()).toBe(true);
        });

        it("should detect failure after max retries", () => {
            graph.addTask(createTask({ id: "t1" }));

            expect(graph.hasFailed()).toBe(false);

            graph.updateTask("t1", { status: "failed", retryCount: 3 });
            expect(graph.hasFailed()).toBe(true);
        });

        it("should not detect failure before max retries", () => {
            graph.addTask(createTask({ id: "t1" }));
            graph.updateTask("t1", { status: "failed", retryCount: 1 });

            expect(graph.hasFailed()).toBe(false);
        });
    });

    // ========================================================================
    // Task Summary
    // ========================================================================

    describe("task summary", () => {
        it("should generate task summary", () => {
            graph.addTask(createTask({ id: "t1", description: "Task 1" }));
            graph.addTask(createTask({ id: "t2", description: "Task 2" }));

            graph.updateTask("t1", { status: "completed" });

            const summary = graph.getTaskSummary();
            expect(summary).toContain("Mission Status");
            expect(summary).toContain("t2");
        });
    });

    // ========================================================================
    // Serialization
    // ========================================================================

    describe("serialization", () => {
        it("should serialize to JSON", () => {
            graph.addTask(createTask({ id: "t1" }));
            graph.addTask(createTask({ id: "t2" }));

            const json = graph.toJSON();
            expect(() => JSON.parse(json)).not.toThrow();
        });

        it("should deserialize from JSON", () => {
            graph.addTask(createTask({ id: "t1" }));
            const json = graph.toJSON();

            const restored = TaskGraph.fromJSON(json);
            expect(restored.getTask("t1")).toBeDefined();
        });
    });
});

describe("Parallel Session State E2E", () => {
    let store: TaskStore;

    beforeEach(() => {
        store = new TaskStore();
    });

    // ========================================================================
    // Pending Tracking
    // ========================================================================

    describe("pending tracking", () => {
        it("should track pending tasks per parent session", () => {
            store.trackPending("session_A", "task_1");
            store.trackPending("session_A", "task_2");
            store.trackPending("session_B", "task_3");

            expect(store.getPendingCount("session_A")).toBe(2);
            expect(store.getPendingCount("session_B")).toBe(1);
            expect(store.getPendingCount("session_C")).toBe(0);
        });

        it("should correctly report hasPending", () => {
            expect(store.hasPending("session_A")).toBe(false);

            store.trackPending("session_A", "task_1");
            expect(store.hasPending("session_A")).toBe(true);

            store.untrackPending("session_A", "task_1");
            expect(store.hasPending("session_A")).toBe(false);
        });

        it("should isolate sessions", () => {
            store.trackPending("session_A", "task_1");
            store.trackPending("session_B", "task_2");

            store.untrackPending("session_A", "task_1");

            expect(store.hasPending("session_A")).toBe(false);
            expect(store.hasPending("session_B")).toBe(true);
        });
    });
});
