import { describe, expect, it, vi } from "vitest";
import { ConcurrencyController } from "../../src/core/agents/concurrency.js";
import { EventHandler } from "../../src/core/agents/manager/event-handler.js";
import { TaskStore } from "../../src/core/agents/task-store.js";
import { TASK_STATUS, type ParallelTask } from "../../src/shared/index.js";

describe("terminal OpenCode 2 child-session events", () => {
    it.each([
        { type: "session.execution.failed", error: { message: "model failed" }, expected: "model failed" },
        { type: "session.execution.interrupted", reason: "user", expected: "Session interrupted" },
    ])("reports $type as a failed task", async event => {
        const store = new TaskStore();
        const concurrency = new ConcurrencyController();
        await concurrency.acquire("Worker");
        const task: ParallelTask = {
            id: "task-1", sessionID: "session-1", parentSessionID: "parent-1",
            description: "work", prompt: "do work", agent: "Worker", depth: 1,
            status: TASK_STATUS.RUNNING, startedAt: new Date(), concurrencyKey: "Worker",
        };
        store.set(task.id, task);
        store.trackPending(task.parentSessionID, task.id);
        const notify = vi.fn().mockResolvedValue(undefined);
        const cleanup = vi.fn();
        const handler = new EventHandler({
            store, concurrency, findBySession: id => store.getBySession(id),
            notifyParentIfAllComplete: notify, scheduleCleanup: cleanup,
            validateSessionHasOutput: vi.fn().mockResolvedValue(false),
        });

        handler.handle({ type: event.type, properties: { sessionID: task.sessionID, error: event.error } });
        await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(task.parentSessionID));

        expect(task.status).toBe(TASK_STATUS.ERROR);
        expect(task.error).toBe(event.expected);
        expect(concurrency.getActiveCount("Worker")).toBe(0);
        expect(store.hasPending(task.parentSessionID)).toBe(false);
        expect(store.getNotifications(task.parentSessionID)[0]?.status).toBe(TASK_STATUS.ERROR);
        expect(cleanup).toHaveBeenCalledWith(task.id);
    });
});
