import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskToastManager, getTaskToastManager, initTaskToastManager } from "../../src/core/notification/task-toast-manager.js";
import { STATUS_LABEL, TASK_STATUS } from "../../src/shared/index.js";

describe("TaskToastManager", () => {
    let manager: TaskToastManager;
    let mockClient: any;
    let mockConcurrency: any;
    let mockTodoSync: any;

    beforeEach(() => {
        manager = new TaskToastManager();
        mockClient = {
            tui: {
                showToast: vi.fn().mockResolvedValue({}),
            },
        };
        mockConcurrency = {
            getConcurrencyLimit: vi.fn().mockReturnValue(3),
        };
        mockTodoSync = {
            updateTaskStatus: vi.fn(),
            removeTask: vi.fn(),
        };
    });

    it("tracks added tasks and displays consolidated toast", () => {
        manager.init(mockClient, mockConcurrency);
        manager.setTodoSync(mockTodoSync);

        manager.addTask({
            id: "t1",
            description: "Compile source",
            agent: "Worker",
            isBackground: true,
            parentSessionID: "p1",
            sessionID: "s1",
        });

        expect(manager.getStats().total).toBe(1);
        const running = manager.getRunningTasks();
        expect(running).toHaveLength(1);
        expect(running[0].description).toBe("Compile source");
        expect(manager.getTasksByParent("p1")).toHaveLength(1);
        expect(mockTodoSync.updateTaskStatus).toHaveBeenCalled();
        expect(mockClient.tui.showToast).toHaveBeenCalled();
    });

    it("updates task status and synchronizes with todoSync", () => {
        manager.init(mockClient, mockConcurrency);
        manager.setTodoSync(mockTodoSync);

        manager.addTask({
            id: "t1",
            description: "Compile source",
            agent: "Worker",
            isBackground: true,
        });

        manager.updateTask("t1", TASK_STATUS.COMPLETED);
        expect(manager.getRunningTasks()).toHaveLength(0);
        expect(mockTodoSync.updateTaskStatus).toHaveBeenCalledTimes(2);

        // Updating nonexistent task should not throw
        manager.updateTask("nonexistent", TASK_STATUS.COMPLETED);
    });

    it("removes task and synchronizes with todoSync", () => {
        manager.init(mockClient, mockConcurrency);
        manager.setTodoSync(mockTodoSync);

        manager.addTask({
            id: "t1",
            description: "Compile source",
            agent: "Worker",
            isBackground: true,
        });

        manager.removeTask("t1");
        expect(manager.getStats().total).toBe(0);
        expect(mockTodoSync.removeTask).toHaveBeenCalledWith("t1");
    });

    it("displays completed task toasts for success, failure, and cancelled", () => {
        manager.init(mockClient, mockConcurrency);

        manager.showCompletionToast({
            id: "t1",
            description: "Compile source",
            agent: "Worker",
            status: STATUS_LABEL.COMPLETED,
            duration: "2.5s",
        });
        expect(mockClient.tui.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                body: expect.objectContaining({
                    title: "Task Completed",
                    variant: "success",
                }),
            })
        );

        manager.showCompletionToast({
            id: "t2",
            description: "Compile failed",
            agent: "Worker",
            status: STATUS_LABEL.ERROR,
            duration: "1.0s",
            error: "Syntax error",
        });
        expect(mockClient.tui.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                body: expect.objectContaining({
                    title: "Task Failed",
                    variant: "error",
                }),
            })
        );
    });

    it("displays all complete, mission complete, and progress toasts", () => {
        manager.init(mockClient);

        manager.showAllCompleteToast("p1", [
            {
                id: "t1",
                description: "Task 1",
                agent: "Worker",
                status: STATUS_LABEL.COMPLETED,
                duration: "2s",
            },
        ]);
        expect(mockClient.tui.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                body: expect.objectContaining({
                    title: "All Tasks Completed",
                }),
            })
        );

        manager.showMissionCompleteToast("Grand Finale", "Mission accomplished");
        expect(mockClient.tui.showToast).toHaveBeenCalled();

        manager.addTask({
            id: "t_prog",
            description: "Long process",
            agent: "Worker",
            isBackground: true,
        });
        manager.showProgressToast("t_prog", { current: 5, total: 10, message: "Halfway done" });
        expect(mockClient.tui.showToast).toHaveBeenCalled();
    });

    it("clears all tracked tasks", () => {
        manager.init(mockClient);
        manager.addTask({
            id: "t1",
            description: "Task 1",
            agent: "Worker",
            isBackground: true,
        });
        manager.addTask({
            id: "t2",
            description: "Task 2",
            agent: "Worker",
            isBackground: true,
            status: STATUS_LABEL.QUEUED,
        });

        expect(manager.getStats().total).toBe(2);
        expect(manager.getQueuedTasks()).toHaveLength(1);

        manager.clear();
        expect(manager.getStats().total).toBe(0);
    });

    it("initializes global singleton instance", () => {
        const inst = initTaskToastManager(mockClient, mockConcurrency);
        expect(inst).toBeDefined();
        expect(getTaskToastManager()).toBe(inst);
    });
});
