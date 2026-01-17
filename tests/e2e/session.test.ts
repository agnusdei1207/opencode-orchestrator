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
