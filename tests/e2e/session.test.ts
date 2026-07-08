/**
 * Session State E2E Tests
 * 
 * Tests for:
 * - Task store operations
 * - Pending task tracking
 * - Session isolation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TaskStore } from "../../src/core/agents/task-store";
import { TASK_STATUS, type ParallelTask } from "../../src/shared";

function createTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: "task_1",
        sessionID: "session_1",
        parentSessionID: "parent_1",
        description: "Task",
        prompt: "Prompt",
        agent: "Worker",
        status: TASK_STATUS.RUNNING,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

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

    describe("session lookup", () => {
        it("indexes tasks by session ID", () => {
            const task = createTask();

            store.set(task.id, task);

            expect(store.getBySession("session_1")).toBe(task);
            expect(store.getBySession("missing")).toBeUndefined();
        });

        it("clears stale session indexes when tasks are replaced or deleted", () => {
            const original = createTask({ id: "task_1", sessionID: "session_old" });
            const replacement = createTask({ id: "task_1", sessionID: "session_new" });

            store.set(original.id, original);
            store.set(replacement.id, replacement);

            expect(store.getBySession("session_old")).toBeUndefined();
            expect(store.getBySession("session_new")).toBe(replacement);

            store.delete(replacement.id);

            expect(store.getBySession("session_new")).toBeUndefined();
        });
    });
});
