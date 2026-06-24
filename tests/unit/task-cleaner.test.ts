import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCleaner } from "../../src/core/agents/manager/task-cleaner";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { TASK_STATUS, type ParallelTask } from "../../src/shared";

const toastMocks = vi.hoisted(() => ({
    showCompletionToast: vi.fn(),
    showAllCompleteToast: vi.fn(),
}));

vi.mock("../../src/core/notification/task-toast-manager.js", () => ({
    getTaskToastManager: vi.fn(() => toastMocks),
}));

describe("TaskCleaner", () => {
    let store: TaskStore;
    let prompt: ReturnType<typeof vi.fn>;
    let cleaner: TaskCleaner;

    beforeEach(() => {
        store = new TaskStore();
        prompt = vi.fn().mockResolvedValue({ data: {} });
        cleaner = new TaskCleaner(
            { session: { prompt } } as unknown as ConstructorParameters<typeof TaskCleaner>[0],
            store,
            new ConcurrencyController(),
            { release: vi.fn().mockResolvedValue(undefined) } as unknown as ConstructorParameters<typeof TaskCleaner>[3],
        );
        vi.clearAllMocks();
    });

    it("keeps rich task details in the user toast while sending compact completion prompt to the parent agent", async () => {
        const task = createTask({
            description: "Sensitive implementation details that should stay out of agent notification",
            status: TASK_STATUS.COMPLETED,
        });
        store.queueNotification(task);

        await cleaner.notifyParentIfAllComplete(task.parentSessionID);

        expect(toastMocks.showCompletionToast).toHaveBeenCalledWith(expect.objectContaining({
            id: task.id,
            description: task.description,
            status: TASK_STATUS.COMPLETED,
        }));
        expect(prompt).toHaveBeenCalledWith({
            path: { id: task.parentSessionID },
            body: {
                noReply: false,
                parts: [{
                    type: "text",
                    text: `[BACKGROUND COMPLETE]\nresults=${task.id}:${task.agent}:done\nnext=get_task_result`,
                }],
            },
        });
        const text = prompt.mock.calls[0][0].body.parts[0].text;
        expect(text).toContain("next=get_task_result");
        expect(text).not.toContain(task.description);
        expect(store.getNotifications(task.parentSessionID)).toEqual([]);
    });

    it("uses noReply and task ids only for partial progress notifications", async () => {
        const task = createTask({ id: "task_done" });
        store.trackPending(task.parentSessionID, "task_still_running");
        store.queueNotification(task);

        await cleaner.notifyParentIfAllComplete(task.parentSessionID);

        expect(prompt).toHaveBeenCalledWith({
            path: { id: task.parentSessionID },
            body: {
                noReply: true,
                parts: [{
                    type: "text",
                    text: "[BACKGROUND UPDATE] completed=1 pending=1\nids=task_done",
                }],
            },
        });
    });
});

function createTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: "task_123",
        sessionID: "session-task",
        parentSessionID: "parent-session",
        description: "Task description",
        prompt: "Do work",
        agent: "Worker",
        status: TASK_STATUS.COMPLETED,
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date(),
        depth: 1,
        reset: vi.fn(),
        ...overrides,
    };
}
