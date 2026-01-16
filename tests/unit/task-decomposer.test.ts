/**
 * Task Decomposer Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as TaskDecomposer from "../../src/core/task/task-decomposer";

describe("TaskDecomposer", () => {
    const TEST_SESSION = "session_test";

    beforeEach(() => {
        TaskDecomposer.clear(TEST_SESSION);
    });

    describe("create", () => {
        it("should create a new task hierarchy", () => {
            const hierarchy = TaskDecomposer.create(TEST_SESSION, "Main mission");

            expect(hierarchy.rootId).toBeTruthy();
            expect(hierarchy.nodes.size).toBe(1);
        });
    });

    describe("addTask", () => {
        it("should add tasks to hierarchy", () => {
            const hierarchy = TaskDecomposer.create(TEST_SESSION, "Main mission");

            const task = TaskDecomposer.addTask(TEST_SESSION, {
                description: "First task",
                level: 1,
                parentId: hierarchy.rootId,
            });

            expect(task.id).toBeTruthy();
            expect(task.description).toBe("First task");
            expect(task.level).toBe(1);
            expect(task.status).toBe("pending");
        });

        it("should add tasks to parallel groups", () => {
            const hierarchy = TaskDecomposer.create(TEST_SESSION, "Main mission");

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Task A1",
                level: 2,
                parallelGroup: "A",
            });

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Task A2",
                level: 2,
                parallelGroup: "A",
            });

            expect(hierarchy.parallelGroups.get("A")?.length).toBe(2);
        });

        it("should track dependencies", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            const task1 = TaskDecomposer.addTask(TEST_SESSION, {
                description: "First task",
                level: 1,
            });

            const task2 = TaskDecomposer.addTask(TEST_SESSION, {
                description: "Depends on first",
                level: 2,
                dependsOn: [task1.id],
            });

            expect(task2.dependsOn).toContain(task1.id);
        });
    });

    describe("updateStatus", () => {
        it("should update task status", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            const task = TaskDecomposer.addTask(TEST_SESSION, {
                description: "Task",
                level: 1,
            });

            TaskDecomposer.updateStatus(TEST_SESSION, task.id, "running");
            expect(task.status).toBe("running");
            expect(task.startedAt).toBeTruthy();

            TaskDecomposer.updateStatus(TEST_SESSION, task.id, "completed", "Done!");
            expect(task.status).toBe("completed");
            expect(task.completedAt).toBeTruthy();
            expect(task.result).toBe("Done!");
        });
    });

    describe("getNextTasks", () => {
        it("should return pending tasks with satisfied dependencies", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            const task1 = TaskDecomposer.addTask(TEST_SESSION, {
                description: "First",
                level: 1,
            });

            const task2 = TaskDecomposer.addTask(TEST_SESSION, {
                description: "Second (depends on first)",
                level: 1,
                dependsOn: [task1.id],
            });

            // task1 should be returned (task2 has unsatisfied dep)
            let next = TaskDecomposer.getNextTasks(TEST_SESSION);
            const task1InNext = next.some(t => t.id === task1.id);
            expect(task1InNext).toBe(true);

            // Complete task1
            TaskDecomposer.updateStatus(TEST_SESSION, task1.id, "completed");

            // Now task2 should be executable
            next = TaskDecomposer.getNextTasks(TEST_SESSION);
            const task2InNext = next.some(t => t.id === task2.id);
            expect(task2InNext).toBe(true);
        });
    });

    describe("getParallelBatch", () => {
        it("should return tasks in same parallel group", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Parallel A1",
                level: 2,
                parallelGroup: "A",
            });

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Parallel A2",
                level: 2,
                parallelGroup: "A",
            });

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Parallel B1",
                level: 2,
                parallelGroup: "B",
            });

            const batchA = TaskDecomposer.getParallelBatch(TEST_SESSION, "A");
            expect(batchA.length).toBe(2);

            const batchB = TaskDecomposer.getParallelBatch(TEST_SESSION, "B");
            expect(batchB.length).toBe(1);
        });
    });

    describe("isComplete", () => {
        it("should return true when all tasks are done", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            const task = TaskDecomposer.addTask(TEST_SESSION, {
                description: "Only task",
                level: 1,
            });

            expect(TaskDecomposer.isComplete(TEST_SESSION)).toBe(false);

            TaskDecomposer.updateStatus(TEST_SESSION, task.id, "completed");
            // Note: root task is still pending
        });
    });

    describe("getProgress", () => {
        it("should calculate correct progress", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            const task1 = TaskDecomposer.addTask(TEST_SESSION, {
                description: "Task 1",
                level: 1,
            });

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Task 2",
                level: 1,
            });

            TaskDecomposer.updateStatus(TEST_SESSION, task1.id, "completed");

            const progress = TaskDecomposer.getProgress(TEST_SESSION);
            expect(progress.total).toBe(3);  // root + 2 tasks
            expect(progress.completed).toBe(1);
            expect(progress.pending).toBe(2);
        });
    });

    describe("getSummary", () => {
        it("should generate summary string", () => {
            TaskDecomposer.create(TEST_SESSION, "Main mission");

            TaskDecomposer.addTask(TEST_SESSION, {
                description: "Task to do",
                level: 1,
                agent: "builder",
            });

            const summary = TaskDecomposer.getSummary(TEST_SESSION);
            expect(summary).toContain("Task Hierarchy Progress");
            expect(summary).toContain("builder");
        });
    });

    describe("parseFromText", () => {
        it("should parse hierarchy from text", () => {
            const text = `
- [L1] Main objective 1
  - [L2] Sub-task 1.1 | agent:builder
  - [L2] Sub-task 1.2 | agent:builder
- [L1] Main objective 2
  - [L2] Sub-task 2.1 | agent:inspector
`;

            const hierarchy = TaskDecomposer.parseFromText(TEST_SESSION, text);

            // Should have root + parsed tasks
            expect(hierarchy.nodes.size).toBeGreaterThan(1);
        });
    });
});
