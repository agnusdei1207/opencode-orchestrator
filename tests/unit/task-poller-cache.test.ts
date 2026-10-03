import { describe, expect, it, vi } from "vitest";
import { TaskPoller } from "../../src/core/agents/manager/task-poller";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { TASK_STATUS, type ParallelTask } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

const REPORTED_MESSAGE_COUNT = 3;

function createTask(id: string): ParallelTask {
    return {
        id,
        sessionID: `session-${id}`,
        parentSessionID: "parent",
        description: "work",
        prompt: "do work",
        agent: "Worker",
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(),
        depth: 1,
    };
}

function createPoller(store: TaskStore, tasks: ParallelTask[]) {
    const statuses = Object.fromEntries(tasks.map(task =>
        [task.sessionID, { type: "busy", messageCount: REPORTED_MESSAGE_COUNT }]));
    const client = { session: {
        status: vi.fn().mockResolvedValue({ data: statuses }),
        messages: vi.fn().mockResolvedValue({ data: [] }),
    } };
    const poller = new TaskPoller({
        client: client as never,
        store,
        concurrency: new ConcurrencyController(),
        notifyParentIfAllComplete: vi.fn().mockResolvedValue(undefined),
        scheduleCleanup: vi.fn(),
        pruneExpiredTasks: vi.fn(),
    });
    return { poller, messages: client.session.messages };
}

function cachedSessions(poller: TaskPoller): string[] {
    return [...(poller as unknown as { messageCache: Map<string, unknown> }).messageCache.keys()];
}

describe("TaskPoller message cache", () => {
    it("drops entries for tasks that ended outside the poller", async () => {
        const store = new TaskStore();
        const cancelled = createTask("cancelled");
        const running = createTask("running");
        store.set(cancelled.id, cancelled);
        store.set(running.id, running);
        const { poller } = createPoller(store, [cancelled, running]);

        await poller.poll();
        expect(cachedSessions(poller).sort()).toEqual([cancelled.sessionID, running.sessionID].sort());

        cancelled.status = TASK_STATUS.ERROR;
        await poller.poll();
        expect(cachedSessions(poller)).toEqual([running.sessionID]);

        running.status = TASK_STATUS.TIMEOUT;
        await poller.poll();
        expect(cachedSessions(poller)).toEqual([]);
    });

    it("refreshes progress for a resumed session instead of trusting its old count", async () => {
        const store = new TaskStore();
        const task = createTask("resumed");
        store.set(task.id, task);
        const { poller, messages } = createPoller(store, [task]);

        await poller.poll();
        task.status = TASK_STATUS.ERROR;
        await poller.poll();
        task.status = TASK_STATUS.RUNNING;
        await poller.poll();

        expect(messages).toHaveBeenCalledTimes(2);
    });
});
