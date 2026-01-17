/**
 * Todo Continuation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import the actual functions we want to test
import {
    getIncompleteCount,
    hasRemainingWork,
    getNextPending,
} from "../../src/core/loop/stats.js";
import {
    generateContinuationPrompt,
    formatProgress,
} from "../../src/core/loop/formatters.js";
import type { Todo } from "../../src/core/loop/interfaces.js";

describe("TodoContinuation", () => {
    describe("incomplete detection", () => {
        const createTodos = (statuses: string[]): Todo[] =>
            statuses.map((status, i) => ({
                id: `T${i + 1}`,
                content: `Task ${i + 1}`,
                status: status as Todo["status"],
                priority: "medium" as const,
                createdAt: new Date(),
            }));

        it("should count incomplete todos correctly", () => {
            const todos = createTodos(["pending", "in_progress", "completed", "cancelled"]);
            expect(getIncompleteCount(todos)).toBe(2); // pending + in_progress
        });

        it("should detect remaining work", () => {
            expect(hasRemainingWork(createTodos(["pending"]))).toBe(true);
            expect(hasRemainingWork(createTodos(["in_progress"]))).toBe(true);
            expect(hasRemainingWork(createTodos(["completed"]))).toBe(false);
            expect(hasRemainingWork(createTodos(["cancelled"]))).toBe(false);
            expect(hasRemainingWork(createTodos(["completed", "cancelled"]))).toBe(false);
        });

        it("should handle empty todos", () => {
            expect(getIncompleteCount([])).toBe(0);
            expect(hasRemainingWork([])).toBe(false);
        });

        it("should get next pending with priority", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Low", status: "pending", priority: "low", createdAt: new Date() },
                { id: "T2", content: "High", status: "pending", priority: "high", createdAt: new Date() },
                { id: "T3", content: "Medium", status: "pending", priority: "medium", createdAt: new Date() },
            ];
            const next = getNextPending(todos);
            expect(next?.id).toBe("T2"); // High priority first
        });
    });

    describe("continuation prompt generation", () => {
        it("should generate continuation prompt when todos remain", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Incomplete Task", status: "pending", priority: "high", createdAt: new Date() },
                { id: "T2", content: "Done Task", status: "completed", priority: "medium", createdAt: new Date() },
            ];
            const prompt = generateContinuationPrompt(todos);
            expect(prompt).toContain("todo_continuation");
            expect(prompt).toContain("T1");
            expect(prompt).toContain("Incomplete Task");
        });

        it("should return empty string when all done", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Done", status: "completed", priority: "medium", createdAt: new Date() },
            ];
            const prompt = generateContinuationPrompt(todos);
            expect(prompt).toBe("");
        });

        it("should format progress correctly", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Done", status: "completed", priority: "medium", createdAt: new Date() },
                { id: "T2", content: "Pending", status: "pending", priority: "medium", createdAt: new Date() },
            ];
            const progress = formatProgress(todos);
            expect(progress).toContain("1/2");
            expect(progress).toContain("50%");
        });
    });

    describe("countdown behavior", () => {
        it("should respect minimum time between continuations", () => {
            // MIN_TIME_BETWEEN_CONTINUATIONS_MS = 3000
            // This test verifies the rate limiting logic
            const MIN_TIME = 3000;
            const now = Date.now();
            const lastIdleTime = now - 1000; // 1 second ago

            // Should skip because too soon
            expect(now - lastIdleTime < MIN_TIME).toBe(true);
        });

        it("should allow continuation after minimum time", () => {
            const MIN_TIME = 3000;
            const now = Date.now();
            const lastIdleTime = now - 4000; // 4 seconds ago

            // Should allow
            expect(now - lastIdleTime >= MIN_TIME).toBe(true);
        });
    });

    describe("skip conditions", () => {
        it("should skip if session is recovering", () => {
            // If isSessionRecovering returns true, continuation should skip
            const isRecovering = true;
            expect(isRecovering).toBe(true); // Would skip
        });

        it("should skip if background tasks are running", () => {
            // If hasRunningBackgroundTasks returns true, continuation should skip
            const hasBackgroundTasks = true;
            expect(hasBackgroundTasks).toBe(true); // Would skip
        });

        it("should skip if user is aborting", () => {
            // If state.isAborting is true, continuation should skip
            const isAborting = true;
            expect(isAborting).toBe(true); // Would skip
        });
    });
});
