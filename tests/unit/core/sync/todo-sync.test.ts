
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseTodoMd } from "../../../../src/core/sync/todo-parser.js";
import { TodoSyncService } from "../../../../src/core/sync/todo-sync-service.js";
import * as fs from "node:fs";

// Mock fs
vi.mock("node:fs", async () => {
    return {
        ...await vi.importActual("node:fs"),
        existsSync: vi.fn(),
        promises: {
            readFile: vi.fn(),
            writeFile: vi.fn(),
        },
        watch: vi.fn(() => ({ close: vi.fn() })),
    };
});

describe("Todo Parser", () => {
    it("should parse pending tasks", () => {
        const input = "- [ ] Task 1\n- [ ] Task 2";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(2);
        expect(result[0].status).toBe("pending");
        expect(result[0].content).toBe("Task 1");
    });

    it("should parse completed tasks", () => {
        const input = "- [x] Done Task";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("completed");
    });

    it("should parse in-progress tasks", () => {
        const input = "- [/] MIP Task";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("in_progress");
    });

    it("should ignore non-task lines", () => {
        const input = "# Title\n- [ ] Task\nJust text";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(1);
    });
});

describe("TodoSyncService", () => {
    let service: TodoSyncService;
    let mockClient: any;

    beforeEach(() => {
        mockClient = {
            session: {
                todo: vi.fn().mockResolvedValue({}),
            }
        };
        service = new TodoSyncService(mockClient, "/tmp");
    });

    it("should register session", () => {
        service.registerSession("sess-1");
        // Access private field for testing or verify behavior via call
        // @ts-ignore
        expect(service.activeSessions.has("sess-1")).toBe(true);
    });

    it("should track task updates without calling session.todo", async () => {
        // TodoSyncService now syncs via .opencode/todo.md file watching
        // instead of calling session.todo() directly (read-only sync)
        service.registerSession("sess-1");

        const task = {
            id: "task-1",
            content: "New Task",
            agent: "worker",
            description: "Test Task",
            status: "running",
            isBackground: true
        };

        service.updateTaskStatus(task);

        // Verify task is tracked internally
        const tasks = Array.from((service as any).taskTodos.values());
        expect(tasks).toHaveLength(1);
        expect(tasks[0]).toMatchObject({
            id: "task-1",
            description: "Test Task",
            status: "running"
        });

        // session.todo() is no longer called (sync via file watch instead)
        expect(mockClient.session.todo).not.toHaveBeenCalled();
    });
});
