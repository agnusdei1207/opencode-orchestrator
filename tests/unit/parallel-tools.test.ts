import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCancelTaskTool } from "../../src/tools/parallel/cancel-task.js";
import { createGetTaskResultTool } from "../../src/tools/parallel/get-task-result.js";
import { createListTasksTool } from "../../src/tools/parallel/list-tasks.js";
import { createListAgentsTool } from "../../src/tools/parallel/list-agents.js";
import { createShowMetricsTool } from "../../src/tools/parallel/show-metrics.js";
import { createUpdateTodoTool } from "../../src/tools/parallel/update-todo.js";
import { createAsyncAgentTools } from "../../src/tools/parallel/index.js";
import { AgentRegistry } from "../../src/core/agents/agent-registry.js";
import { MetricsCollector } from "../../src/core/metrics/collector.js";
import { TodoManager } from "../../src/core/todo/todo-manager.js";
import { TASK_STATUS, STATUS_LABEL, OUTPUT_LABEL, PARALLEL_PARAMS } from "../../src/shared/index.js";

describe("Parallel Tools Suite", () => {
    let mockManager: any;

    beforeEach(() => {
        MetricsCollector._resetForTesting();
        mockManager = {
            cancelTask: vi.fn(),
            getTask: vi.fn(),
            getAllTasks: vi.fn().mockReturnValue([]),
            getRunningTasks: vi.fn().mockReturnValue([]),
            getResult: vi.fn(),
        };
    });

    describe("cancel_task", () => {
        it("cancels a running task successfully", async () => {
            const tool = createCancelTaskTool(mockManager);
            mockManager.cancelTask.mockResolvedValue(true);

            const result = await (tool as any).execute({ taskId: "task-1" });
            expect(result).toContain(OUTPUT_LABEL.CANCELLED);
            expect(result).toContain("task-1");
        });

        it("warns if task exists but cannot be cancelled", async () => {
            const tool = createCancelTaskTool(mockManager);
            mockManager.cancelTask.mockResolvedValue(false);
            mockManager.getTask.mockReturnValue({ id: "task-1", status: TASK_STATUS.COMPLETED });

            const result = await (tool as any).execute({ taskId: "task-1" });
            expect(result).toContain(OUTPUT_LABEL.WARNING);
            expect(result).toContain("completed");
        });

        it("returns error if task not found", async () => {
            const tool = createCancelTaskTool(mockManager);
            mockManager.cancelTask.mockResolvedValue(false);
            mockManager.getTask.mockReturnValue(undefined);

            const result = await (tool as any).execute({ taskId: "task-missing" });
            expect(result).toContain(OUTPUT_LABEL.ERROR);
            expect(result).toContain("task-missing");
        });
    });

    describe("get_task_result", () => {
        it("returns error if task not found", async () => {
            const tool = createGetTaskResultTool(mockManager);
            mockManager.getTask.mockReturnValue(undefined);

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.TASK_ID]: "task-1" });
            expect(result).toContain(OUTPUT_LABEL.ERROR);
            expect(result).toContain("not found");
        });

        it("returns still working if task is running", async () => {
            const tool = createGetTaskResultTool(mockManager);
            mockManager.getTask.mockReturnValue({
                id: "task-1",
                status: STATUS_LABEL.RUNNING,
            });

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.TASK_ID]: "task-1" });
            expect(result).toContain(OUTPUT_LABEL.RUNNING);
            expect(result).toContain("Still working");
        });

        it("returns error message if task ended in error or timeout", async () => {
            const tool = createGetTaskResultTool(mockManager);
            mockManager.getTask.mockReturnValue({
                id: "task-1",
                status: STATUS_LABEL.ERROR,
                error: "Fatal crash",
                startedAt: new Date(Date.now() - 2000),
                completedAt: new Date(),
            });

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.TASK_ID]: "task-1" });
            expect(result).toContain("[ERROR]");
            expect(result).toContain("Fatal crash");
        });

        it("returns completed result with duration and output", async () => {
            const tool = createGetTaskResultTool(mockManager);
            mockManager.getTask.mockReturnValue({
                id: "task-1",
                status: STATUS_LABEL.COMPLETED,
                startedAt: new Date(Date.now() - 5000),
                completedAt: new Date(),
            });
            mockManager.getResult.mockResolvedValue("Work finished successfully");

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.TASK_ID]: "task-1" });
            expect(result).toContain(OUTPUT_LABEL.DONE);
            expect(result).toContain("Work finished successfully");
        });

        it("handles empty completed output", async () => {
            const tool = createGetTaskResultTool(mockManager);
            mockManager.getTask.mockReturnValue({
                id: "task-1",
                status: STATUS_LABEL.COMPLETED,
                startedAt: new Date(Date.now() - 5000),
                completedAt: new Date(),
            });
            mockManager.getResult.mockResolvedValue(null);

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.TASK_ID]: "task-1" });
            expect(result).toContain(OUTPUT_LABEL.DONE);
            expect(result).toContain("(No output)");
        });
    });

    describe("list_tasks", () => {
        it("returns notice when no tasks exist", async () => {
            const tool = createListTasksTool(mockManager);
            const result = await (tool as any).execute({});
            expect(result).toBe("No tasks found.");
        });

        it("lists running tasks", async () => {
            const tool = createListTasksTool(mockManager);
            mockManager.getRunningTasks.mockReturnValue([
                { id: "t1", status: "running", agent: "worker", startedAt: new Date(Date.now() - 3000) },
            ]);

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.STATUS]: STATUS_LABEL.RUNNING });
            expect(result).toContain("t1");
            expect(result).toContain("[RUNNING]");
            expect(result).toContain("worker");
        });

        it("lists completed tasks", async () => {
            const tool = createListTasksTool(mockManager);
            mockManager.getAllTasks.mockReturnValue([
                { id: "t2", status: TASK_STATUS.COMPLETED, agent: "reviewer", startedAt: new Date(Date.now() - 10000) },
            ]);

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.STATUS]: STATUS_LABEL.COMPLETED });
            expect(result).toContain("t2");
            expect(result).toContain("[COMPLETED]");
        });

        it("lists error tasks", async () => {
            const tool = createListTasksTool(mockManager);
            mockManager.getAllTasks.mockReturnValue([
                { id: "t3", status: TASK_STATUS.ERROR, agent: "planner", startedAt: new Date(Date.now() - 15000) },
            ]);

            const result = await (tool as any).execute({ [PARALLEL_PARAMS.STATUS]: STATUS_LABEL.ERROR });
            expect(result).toContain("t3");
            expect(result).toContain("[ERROR]");
        });
    });

    describe("list_agents", () => {
        it("lists available agents", async () => {
            const tool = createListAgentsTool();
            const result = await (tool as any).execute();
            expect(result).toContain("Available Agents:");
            expect(result).toContain("Commander");
            expect(result).toContain("Worker");
        });

        it("handles empty registry gracefully", async () => {
            const registry = AgentRegistry.getInstance();
            const originalList = registry.listAgents;
            registry.listAgents = () => [];

            const tool = createListAgentsTool();
            const result = await (tool as any).execute();
            expect(result).toContain("No agents registered");

            registry.listAgents = originalList;
        });
    });

    describe("show_metrics", () => {
        it("displays performance metrics table", async () => {
            const collector = MetricsCollector.getInstance();
            collector.recordToolExecution("grep_search", 150);
            collector.recordAgentExecution("worker", 2500);
            collector.recordTokenUsage(1200);
            collector.recordTaskResult("task-1", true);

            const tool = createShowMetricsTool();
            const result = await (tool as any).execute();

            expect(result).toContain("Performance Dashboard");
            expect(result).toContain("grep_search");
            expect(result).toContain("150ms");
            expect(result).toContain("worker");
            expect(result).toContain("2500ms");
            expect(result).toContain("100%");
        });
    });

    describe("update_todo", () => {
        it("requires status for update action", async () => {
            const tool = createUpdateTodoTool();
            const result = await (tool as any).execute({ action: "update", task: "Build feature" });
            expect(result).toContain(OUTPUT_LABEL.ERROR);
            expect(result).toContain("'status' is required");
        });

        it("updates status of existing task", async () => {
            const manager = TodoManager.getInstance();
            const spy = vi.spyOn(manager, "updateItem").mockResolvedValue(true);

            const tool = createUpdateTodoTool();
            const result = await (tool as any).execute({ action: "update", task: "Build feature", status: "completed" });
            expect(result).toContain(OUTPUT_LABEL.DONE);
            expect(result).toContain("Updated task status");
            spy.mockRestore();
        });

        it("reports error when update task is not found", async () => {
            const manager = TodoManager.getInstance();
            const spy = vi.spyOn(manager, "updateItem").mockResolvedValue(false);

            const tool = createUpdateTodoTool();
            const result = await (tool as any).execute({ action: "update", task: "Nonexistent", status: "completed" });
            expect(result).toContain(OUTPUT_LABEL.ERROR);
            expect(result).toContain("Task not found");
            spy.mockRestore();
        });

        it("requires subtask for add action", async () => {
            const tool = createUpdateTodoTool();
            const result = await (tool as any).execute({ action: "add", task: "Parent" });
            expect(result).toContain(OUTPUT_LABEL.ERROR);
            expect(result).toContain("'subtask' is required");
        });

        it("adds subtask under parent task", async () => {
            const manager = TodoManager.getInstance();
            const spy = vi.spyOn(manager, "addSubTask").mockResolvedValue(true);

            const tool = createUpdateTodoTool();
            const result = await (tool as any).execute({ action: "add", task: "Parent", subtask: "Child subtask" });
            expect(result).toContain(OUTPUT_LABEL.DONE);
            expect(result).toContain("Added sub-task");
            spy.mockRestore();
        });

        it("reports error when parent task is not found for add", async () => {
            const manager = TodoManager.getInstance();
            const spy = vi.spyOn(manager, "addSubTask").mockResolvedValue(false);

            const tool = createUpdateTodoTool();
            const result = await (tool as any).execute({ action: "add", task: "Parent", subtask: "Child subtask" });
            expect(result).toContain(OUTPUT_LABEL.ERROR);
            expect(result).toContain("Parent task not found");
            spy.mockRestore();
        });
    });

    describe("createAsyncAgentTools factory", () => {
        it("creates all 7 async agent tools", () => {
            const tools = createAsyncAgentTools(mockManager);
            expect(Object.keys(tools)).toHaveLength(7);
            expect(tools.delegate_task).toBeDefined();
            expect(tools.get_task_result).toBeDefined();
            expect(tools.list_tasks).toBeDefined();
            expect(tools.cancel_task).toBeDefined();
            expect(tools.list_agents).toBeDefined();
            expect(tools.show_metrics).toBeDefined();
            expect(tools.update_todo).toBeDefined();
        });
    });
});
