import { describe, expect, it, vi } from "vitest";
import { TaskPoller } from "../../src/core/agents/manager/task-poller";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { PARALLEL_TASK, TASK_STATUS, type ParallelTask } from "../../src/shared";
import type { HostMessage } from "../../src/host/client";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

function createTask(id: string): ParallelTask {
    return {
        id,
        sessionID: `session-${id}`,
        parentSessionID: "parent",
        description: "work",
        prompt: "do work",
        agent: "Worker",
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(Date.now() - PARALLEL_TASK.MIN_STABILITY_MS - 1_000),
        depth: 1,
    };
}

function createPoller(store: TaskStore, busy: Record<string, string>, messages: HostMessage[] = []) {
    const statusMap = new Map(Object.entries(busy));
    const client = {
        statuses: vi.fn(() => statusMap as ReadonlyMap<string, string>),
        messages: vi.fn().mockResolvedValue(messages),
    };
    const poller = new TaskPoller({
        client: client as never,
        store,
        concurrency: new ConcurrencyController(),
        notifyParentIfAllComplete: vi.fn().mockResolvedValue(undefined),
        scheduleCleanup: vi.fn(),
        pruneExpiredTasks: vi.fn(),
    });
    return { poller, client };
}

describe("TaskPoller host reads", () => {
    it("reads one status snapshot per poll and no messages for busy sessions", async () => {
        const store = new TaskStore();
        const a = createTask("a");
        const b = createTask("b");
        store.set(a.id, a);
        store.set(b.id, b);
        const { poller, client } = createPoller(store, { [a.sessionID]: "busy", [b.sessionID]: "busy" });

        await poller.poll();

        expect(client.statuses).toHaveBeenCalledTimes(1);
        expect(client.messages).not.toHaveBeenCalled();
        expect(a.status).toBe(TASK_STATUS.RUNNING);
        expect(b.status).toBe(TASK_STATUS.RUNNING);
    });

    it("skips tasks that ended outside the poller", async () => {
        const store = new TaskStore();
        const cancelled = createTask("cancelled");
        const running = createTask("running");
        store.set(cancelled.id, cancelled);
        store.set(running.id, running);
        const { poller, client } = createPoller(store, {});

        cancelled.status = TASK_STATUS.ERROR;
        await poller.poll();

        expect(client.messages).toHaveBeenCalledTimes(1);
        expect(client.messages).toHaveBeenCalledWith(running.sessionID);
    });

    it("rereads messages for a resumed session on every idle poll", async () => {
        const store = new TaskStore();
        const task = createTask("resumed");
        store.set(task.id, task);
        const { poller, client } = createPoller(store, {});

        await poller.poll();
        task.status = TASK_STATUS.ERROR;
        await poller.poll();
        task.status = TASK_STATUS.RUNNING;
        await poller.poll();

        expect(client.messages).toHaveBeenCalledTimes(2);
    });
});
