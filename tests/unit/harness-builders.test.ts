import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    createParallelTask,
    createParallelTasks,
    createBackgroundTask,
    createTodo,
    createTodos,
    createMockClient,
    createMockState,
    resetBuilderCounters,
} from "../harness";

describe("harness/builders", () => {
    beforeEach(() => {
        resetBuilderCounters();
    });

    describe("createParallelTask", () => {
        it("creates a task with default values", () => {
            const task = createParallelTask();

            expect(task.id).toMatch(/^test-task-1$/);
            expect(task.description).toBe("Test task test-task-1");
            expect(task.status).toBe("pending");
            expect(task.agent).toBe("test");
            expect(task.depth).toBe(0);
        });

        it("creates a task with custom values", () => {
            const task = createParallelTask({
                id: "custom-id",
                description: "Custom description",
                prompt: "Custom prompt",
                status: "running",
            });

            expect(task.id).toBe("custom-id");
            expect(task.description).toBe("Custom description");
            expect(task.prompt).toBe("Custom prompt");
            expect(task.status).toBe("running");
            expect(task.agent).toBe("test");
        });

        it("increments counter for each task", () => {
            const task1 = createParallelTask();
            const task2 = createParallelTask();

            expect(task1.id).toBe("test-task-1");
            expect(task2.id).toBe("test-task-2");
        });

        it("creates tasks with session IDs", () => {
            const task = createParallelTask({ sessionId: "session-123" });

            expect(task.sessionID).toBe("session-123");
        });
    });

    describe("createParallelTasks", () => {
        it("creates multiple tasks", () => {
            const tasks = createParallelTasks(3);

            expect(tasks).toHaveLength(3);
            expect(tasks[0].id).toBe("test-task-1");
            expect(tasks[1].id).toBe("test-task-2");
            expect(tasks[2].id).toBe("test-task-3");
        });

        it("creates tasks with custom prefix", () => {
            const tasks = createParallelTasks(2, {
                id: "batch",
                description: "Batch task",
            });

            expect(tasks[0].id).toBe("batch-0");
            expect(tasks[1].id).toBe("batch-1");
            expect(tasks[0].description).toBe("Batch task 1");
            expect(tasks[1].description).toBe("Batch task 2");
        });
    });

    describe("createBackgroundTask", () => {
        it("creates a task with defaults", () => {
            const task = createBackgroundTask();

            expect(task.id).toMatch(/^bg-task-1$/);
            expect(task.command).toBe("echo test");
            expect(task.args).toEqual([]);
            expect(task.status).toBe("running");
            expect(task.output).toBe("");
        });

        it("creates a task with custom values", () => {
            const task = createBackgroundTask({
                id: "custom-bg",
                command: "npm",
                status: "done",
                exitCode: 0,
            });

            expect(task.id).toBe("custom-bg");
            expect(task.command).toBe("npm");
            expect(task.status).toBe("done");
            expect(task.exitCode).toBe(0);
        });

        it("has correct default timeout", () => {
            const task = createBackgroundTask();
            expect(task.timeout).toBe(30000);
        });
    });

    describe("createTodo", () => {
        it("creates a todo with defaults", () => {
            const todo = createTodo();

            expect(todo.id).toMatch(/^todo-1$/);
            expect(todo.content).toBe("Test todo todo-1");
            expect(todo.status).toBe("pending");
            expect(todo.priority).toBe("medium");
        });

        it("creates a todo with custom values", () => {
            const todo = createTodo({
                id: "custom-todo",
                content: "Custom todo content",
                status: "completed",
                priority: "high",
            });

            expect(todo.id).toBe("custom-todo");
            expect(todo.content).toBe("Custom todo content");
            expect(todo.status).toBe("completed");
            expect(todo.priority).toBe("high");
        });
    });

    describe("createTodos", () => {
        it("creates multiple todos", () => {
            const todos = createTodos(3);

            expect(todos).toHaveLength(3);
            expect(todos[0].id).toBe("todo-1");
            expect(todos[1].id).toBe("todo-2");
            expect(todos[2].id).toBe("todo-3");
        });

        it("creates todos with custom prefix", () => {
            const todos = createTodos(2, {
                id: "batch",
                content: "Batch item",
            });

            expect(todos[0].id).toBe("batch-0");
            expect(todos[1].id).toBe("batch-1");
            expect(todos[0].content).toBe("Batch item 1");
        });
    });

    describe("createMockClient", () => {
        it("creates a mock client with stubbed methods", () => {
            const client = createMockClient() as any;

            expect(client.toast).toBeDefined();
            expect(client.session).toBeDefined();
            expect(client.tool).toBeDefined();

            expect(typeof client.toast.show).toBe("function");
            expect(typeof client.session.create).toBe("function");
            expect(typeof client.tool.execute).toBe("function");
        });

        it("allows overrides", () => {
            const client = createMockClient({
                customField: "custom",
            });

            expect((client as any).customField).toBe("custom");
        });
    });

    describe("createMockState", () => {
        it("creates mock orchestrator state", () => {
            const state = createMockState();

            expect(state.missionId).toBe("test-mission");
            expect(state.currentPhase).toBe("discovery");
            expect(state.todos).toEqual([]);
            expect(state.completedSteps).toEqual([]);
            expect(state.errors).toEqual([]);
        });

        it("allows overrides", () => {
            const state = createMockState({
                missionId: "override-mission",
                currentPhase: "execution",
            });

            expect(state.missionId).toBe("override-mission");
            expect(state.currentPhase).toBe("execution");
        });
    });

    describe("resetBuilderCounters", () => {
        it("resets all counters", () => {
            createParallelTask();
            createBackgroundTask();
            createTodo();

            resetBuilderCounters();

            const task = createParallelTask();
            const bgTask = createBackgroundTask();
            const todo = createTodo();

            expect(task.id).toBe("test-task-1");
            expect(bgTask.id).toBe("bg-task-1");
            expect(todo.id).toBe("todo-1");
        });
    });
});
