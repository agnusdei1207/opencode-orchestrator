/**
 * Todo Enforcer Unit Tests
 */

import { describe, it, expect } from "vitest";
import {
    parseTodos,
    getIncompleteCount,
    hasRemainingWork,
    getNextPending,
    getStats,
    formatProgress,
    generateContinuationPrompt,
    isMissionComplete,
    generateCompletionMessage,
    type Todo,
} from "../../src/core/loop/todo-enforcer";

describe("TodoEnforcer", () => {
    const createTodo = (overrides: Partial<Todo> = {}): Todo => ({
        id: "todo_1",
        content: "Test todo",
        status: "pending",
        priority: "medium",
        createdAt: new Date(),
        ...overrides,
    });

    describe("parseTodos", () => {
        it("should parse valid todo array", () => {
            const data = [
                { id: "1", content: "Task 1", status: "pending", priority: "high" },
                { id: "2", content: "Task 2", status: "completed", priority: "low" },
            ];

            const todos = parseTodos(data);

            expect(todos.length).toBe(2);
            expect(todos[0].id).toBe("1");
            expect(todos[0].status).toBe("pending");
            expect(todos[1].status).toBe("completed");
        });

        it("should return empty array for non-array input", () => {
            expect(parseTodos(null)).toEqual([]);
            expect(parseTodos(undefined)).toEqual([]);
            expect(parseTodos("string")).toEqual([]);
            expect(parseTodos({})).toEqual([]);
        });
    });

    describe("getIncompleteCount", () => {
        it("should count pending and in_progress todos", () => {
            const todos: Todo[] = [
                createTodo({ status: "pending" }),
                createTodo({ status: "in_progress" }),
                createTodo({ status: "completed" }),
                createTodo({ status: "cancelled" }),
            ];

            expect(getIncompleteCount(todos)).toBe(2);
        });

        it("should return 0 for empty array", () => {
            expect(getIncompleteCount([])).toBe(0);
        });
    });

    describe("hasRemainingWork", () => {
        it("should return true if incomplete todos exist", () => {
            const todos: Todo[] = [
                createTodo({ status: "pending" }),
                createTodo({ status: "completed" }),
            ];

            expect(hasRemainingWork(todos)).toBe(true);
        });

        it("should return false if all todos are done", () => {
            const todos: Todo[] = [
                createTodo({ status: "completed" }),
                createTodo({ status: "cancelled" }),
            ];

            expect(hasRemainingWork(todos)).toBe(false);
        });
    });

    describe("getNextPending", () => {
        it("should return highest priority pending todo", () => {
            const todos: Todo[] = [
                createTodo({ id: "1", priority: "low", status: "pending" }),
                createTodo({ id: "2", priority: "high", status: "pending" }),
                createTodo({ id: "3", priority: "medium", status: "pending" }),
            ];

            const next = getNextPending(todos);
            expect(next?.id).toBe("2"); // High priority
        });

        it("should return undefined if no pending todos", () => {
            const todos: Todo[] = [
                createTodo({ status: "completed" }),
            ];

            expect(getNextPending(todos)).toBeUndefined();
        });

        it("should include in_progress todos", () => {
            const todos: Todo[] = [
                createTodo({ id: "1", status: "in_progress", priority: "medium" }),
                createTodo({ id: "2", status: "completed" }),
            ];

            const next = getNextPending(todos);
            expect(next?.id).toBe("1");
        });
    });

    describe("getStats", () => {
        it("should calculate correct statistics", () => {
            const todos: Todo[] = [
                createTodo({ status: "pending" }),
                createTodo({ status: "pending" }),
                createTodo({ status: "in_progress" }),
                createTodo({ status: "completed" }),
                createTodo({ status: "completed" }),
                createTodo({ status: "completed" }),
                createTodo({ status: "cancelled" }),
            ];

            const stats = getStats(todos);

            expect(stats.total).toBe(7);
            expect(stats.pending).toBe(2);
            expect(stats.inProgress).toBe(1);
            expect(stats.completed).toBe(3);
            expect(stats.cancelled).toBe(1);
            expect(stats.percentComplete).toBe(57); // (3+1)/7 ≈ 57%
        });

        it("should handle empty todos", () => {
            const stats = getStats([]);

            expect(stats.total).toBe(0);
            expect(stats.percentComplete).toBe(0);
        });
    });

    describe("formatProgress", () => {
        it("should format progress correctly", () => {
            const todos: Todo[] = [
                createTodo({ status: "completed" }),
                createTodo({ status: "completed" }),
                createTodo({ status: "pending" }),
                createTodo({ status: "pending" }),
            ];

            expect(formatProgress(todos)).toBe("2/4 (50%)");
        });
    });

    describe("generateContinuationPrompt", () => {
        it("should generate prompt with incomplete todos", () => {
            const todos: Todo[] = [
                createTodo({ id: "1", content: "Task 1", status: "pending", priority: "high" }),
                createTodo({ id: "2", content: "Task 2", status: "completed" }),
            ];

            const prompt = generateContinuationPrompt(todos);

            expect(prompt).toContain("todo_continuation");
            expect(prompt).toContain("Incomplete Tasks");
            expect(prompt).toContain("1 remaining");
        });

        it("should return empty string if no incomplete todos", () => {
            const todos: Todo[] = [
                createTodo({ status: "completed" }),
            ];

            expect(generateContinuationPrompt(todos)).toBe("");
        });
    });

    describe("isMissionComplete", () => {
        it("should return true when all todos done", () => {
            const todos: Todo[] = [
                createTodo({ status: "completed" }),
                createTodo({ status: "cancelled" }),
            ];

            expect(isMissionComplete(todos)).toBe(true);
        });

        it("should return false when incomplete todos exist", () => {
            const todos: Todo[] = [
                createTodo({ status: "pending" }),
                createTodo({ status: "completed" }),
            ];

            expect(isMissionComplete(todos)).toBe(false);
        });

        it("should return false for empty todos", () => {
            expect(isMissionComplete([])).toBe(false);
        });
    });

    describe("generateCompletionMessage", () => {
        it("should generate completion message with stats", () => {
            const todos: Todo[] = [
                createTodo({ status: "completed" }),
                createTodo({ status: "completed" }),
                createTodo({ status: "cancelled" }),
            ];

            const message = generateCompletionMessage(todos);

            expect(message).toContain("[Verified Complete]");
            expect(message).toContain("Total Tasks: 3");
            expect(message).toContain("Completed: 2");
            expect(message).toContain("Cancelled: 1");
        });
    });
});
