import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCleaner } from "../../src/core/agents/manager/task-cleaner";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { CONFIG } from "../../src/core/agents/config";
import { TASK_STATUS, type ParallelTask } from "../../src/shared";
import {
    peekPrompts,
    hasPendingPrompts,
    resetPendingInjections,
} from "../../src/core/session/pending-injection";
import { resetSessionActivity } from "../../src/core/session/activity";

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
    let concurrency: ConcurrencyController;
    let cleaner: TaskCleaner;

    beforeEach(() => {
        store = new TaskStore();
        prompt = vi.fn().mockResolvedValue({ data: {} });
        concurrency = new ConcurrencyController();
        cleaner = new TaskCleaner(
            { session: { prompt } } as unknown as ConstructorParameters<typeof TaskCleaner>[0],
            store,
            concurrency,
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
                    synthetic: true,
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
                    synthetic: true,
                    text: "[BACKGROUND UPDATE] completed=1 pending=1\nids=task_done",
                }],
            },
        });
    });

    it("reports timed-out running tasks as failed and clears their concurrency slot", async () => {
        await concurrency.acquire("builder");
        const reportResult = vi.spyOn(concurrency, "reportResult");
        const task = createTask({
            status: TASK_STATUS.RUNNING,
            startedAt: new Date(Date.now() - CONFIG.TASK_TTL_MS - 1),
            concurrencyKey: "builder",
        });
        store.set(task.id, task);
        store.trackPending(task.parentSessionID, task.id);

        cleaner.pruneExpiredTasks();

        expect(concurrency.getActiveCount("builder")).toBe(0);
        expect(task.concurrencyKey).toBeUndefined();
        expect(reportResult).toHaveBeenCalledWith("builder", false);
        expect(store.get(task.id)).toBeUndefined();
        expect(store.hasPending(task.parentSessionID)).toBe(false);
    });

    /**
     * Issue #38: a parent agent is very often mid-turn when its background
     * subagents finish. `noReply: true` does not make that write safe — upstream
     * persists the user message and only skips starting a new run, so the text
     * still lands inside the turn the model is executing.
     */
    describe("busy parent", () => {
        function cleanerWithStatus(busy: boolean) {
            const send = vi.fn().mockResolvedValue({ data: {} });
            const client = {
                session: {
                    prompt: send,
                    status: vi.fn().mockResolvedValue({
                        data: busy ? { "parent-session": { type: "busy" } } : {},
                    }),
                },
            };
            return {
                send,
                cleaner: new TaskCleaner(
                    client as unknown as ConstructorParameters<typeof TaskCleaner>[0],
                    store,
                    concurrency,
                    { release: vi.fn().mockResolvedValue(undefined) } as unknown as ConstructorParameters<typeof TaskCleaner>[3],
                ),
            };
        }

        beforeEach(() => {
            resetPendingInjections();
            resetSessionActivity();
        });

        it("queues the notification instead of interrupting a working parent", async () => {
            const task = createTask();
            store.queueNotification(task);
            const { cleaner: busyCleaner, send } = cleanerWithStatus(true);

            await busyCleaner.notifyParentIfAllComplete(task.parentSessionID);

            expect(send).not.toHaveBeenCalled();
            // Which task finished is information the model cannot reconstruct,
            // so it must be parked rather than dropped.
            expect(peekPrompts("parent-session")).toEqual([
                `[BACKGROUND COMPLETE]\nresults=${task.id}:${task.agent}:done\nnext=get_task_result`,
            ]);
        });

        it("notifies immediately when the parent is idle", async () => {
            const task = createTask();
            store.queueNotification(task);
            const { cleaner: idleCleaner, send } = cleanerWithStatus(false);

            await idleCleaner.notifyParentIfAllComplete(task.parentSessionID);

            expect(send).toHaveBeenCalledTimes(1);
            expect(hasPendingPrompts("parent-session")).toBe(false);
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
