import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCleaner } from "../../src/core/agents/manager/task-cleaner";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { PARALLEL_TASK, TASK_STATUS, type ParallelTask } from "../../src/shared";
import {
    peekPrompts,
    hasPendingPrompts,
    resetPendingInjections,
} from "../../src/core/session/pending-injection";
import { resetSessionActivity } from "../../src/core/session/activity";

/** Upper bound task-lifecycle waits for a host interrupt confirmation. */
const SESSION_ABORT_TIMEOUT_MS = 30_000;

type CleanerClient = ConstructorParameters<typeof TaskCleaner>[0];
type CleanerRegistry = ConstructorParameters<typeof TaskCleaner>[3];

let store: TaskStore;
let prompt: ReturnType<typeof vi.fn>;
let concurrency: ConcurrencyController;
let cleaner: TaskCleaner;

function createClient(overrides: Record<string, unknown> = {}) {
    return {
        prompt,
        statuses: vi.fn(() => new Map<string, string>()),
        interrupt: vi.fn().mockResolvedValue(true),
        ...overrides,
    } as unknown as CleanerClient;
}

function createRegistry() {
    return { release: vi.fn().mockResolvedValue(undefined) } as unknown as CleanerRegistry;
}

beforeEach(() => {
    store = new TaskStore();
    prompt = vi.fn().mockResolvedValue(undefined);
    concurrency = new ConcurrencyController();
    cleaner = new TaskCleaner(createClient(), store, concurrency, createRegistry());
    resetPendingInjections();
    resetSessionActivity();
});

it("sends a compact completion prompt to the parent agent", async () => {
    const task = createTask({
        description: "Sensitive implementation details that should stay out of agent notification",
        status: TASK_STATUS.COMPLETED,
    });
    store.queueNotification(task);

    await cleaner.notifyParentIfAllComplete(task.parentSessionID);

    expect(prompt).toHaveBeenCalledWith({
        sessionID: task.parentSessionID,
        text: `[BACKGROUND COMPLETE]\nresults=${task.id}:${task.agent}:done\nnext=get_task_result`,
        synthetic: true,
        reply: true,
    });
    const text = prompt.mock.calls[0][0].text;
    expect(text).toContain("next=get_task_result");
    expect(text).not.toContain(task.description);
    expect(store.getNotifications(task.parentSessionID)).toEqual([]);
});

it("does not start a turn and sends task ids only for partial progress notifications", async () => {
    const task = createTask({ id: "task_done" });
    store.trackPending(task.parentSessionID, "task_still_running");
    store.queueNotification(task);

    await cleaner.notifyParentIfAllComplete(task.parentSessionID);

    expect(prompt).toHaveBeenCalledWith({
        sessionID: task.parentSessionID,
        text: "[BACKGROUND UPDATE] completed=1 pending=1\nids=task_done",
        synthetic: true,
        reply: false,
    });
});

it("retains notifications when delivery fails", async () => {
    const task = createTask();
    store.queueNotification(task);
    prompt.mockRejectedValueOnce(new Error("offline"));
    await cleaner.notifyParentIfAllComplete(task.parentSessionID);
    expect(store.getNotifications(task.parentSessionID)).toEqual([task]);
});

it("retries failed delivery together with later notices", async () => {
    const first = createTask({ id: "first" });
    const second = createTask({ id: "second" });
    store.queueNotification(first);
    prompt.mockRejectedValueOnce(new Error("offline"));
    await cleaner.notifyParentIfAllComplete(first.parentSessionID);

    store.queueNotification(second);
    await cleaner.notifyParentIfAllComplete(first.parentSessionID);

    expect(prompt).toHaveBeenCalledTimes(2);
    const text = prompt.mock.calls[1][0].text as string;
    expect(text).toContain("first");
    expect(text).toContain("second");
    expect(store.getNotifications(first.parentSessionID)).toEqual([]);
});

it("acknowledges only the notification batch actually sent", async () => {
    const first = createTask({ id: "first" });
    const second = createTask({ id: "second" });
    store.queueNotification(first);
    prompt.mockImplementationOnce(async () => {
        store.queueNotification(second);
    });
    await cleaner.notifyParentIfAllComplete(first.parentSessionID);
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(prompt.mock.calls[1][0].text).toContain("second");
    expect(store.getNotifications(first.parentSessionID)).toEqual([]);
});

it("reports timed-out running tasks as failed and clears their concurrency slot", async () => {
    concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
    cleaner = new TaskCleaner(createClient(), store, concurrency, createRegistry());
    await concurrency.acquire("builder");
    const task = createTask({
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(Date.now() - PARALLEL_TASK.TTL_MS - 1),
        completedAt: undefined,
        concurrencyKey: "builder",
    });
    store.set(task.id, task);
    store.trackPending(task.parentSessionID, task.id);

    cleaner.pruneExpiredTasks();
    await vi.waitFor(() => expect(task.status).toBe(TASK_STATUS.TIMEOUT));

    expect(concurrency.getActiveCount("builder")).toBe(0);
    expect(task.concurrencyKey).toBeUndefined();
    expect(task.error).toBe("Task exceeded time limit");
    expect(store.getPendingCount(task.parentSessionID)).toBe(0);

    // Issue #41: the parent must learn the task timed out, or it waits on
    // a result that never arrives.
    await vi.waitFor(() => {
        expect(prompt).toHaveBeenCalledTimes(1);
    });
    const text = prompt.mock.calls[0][0].text as string;
    expect(text).toContain(task.id);
    expect(text.toLowerCase()).toContain("timeout");

    // The task stays readable for get_task_result until scheduleCleanup's
    // delayed deletion, rather than vanishing the moment the parent is told.
    expect(store.get(task.id)?.status).toBe(TASK_STATUS.TIMEOUT);
    cleaner.shutdown();
});

it("does not re-fire a timeout while the previous abort is still unconfirmed", async () => {
    const interrupt = vi.fn();
    let confirmAbort!: (value: boolean) => void;
    interrupt.mockImplementationOnce(() => new Promise(resolve => { confirmAbort = resolve; }));
    interrupt.mockResolvedValue(true);
    const guarded = new TaskCleaner(createClient({ interrupt }), store, concurrency, createRegistry());
    const task = createTask({ status: TASK_STATUS.RUNNING, startedAt: new Date(Date.now() - PARALLEL_TASK.TTL_MS - 1) });
    store.set(task.id, task);

    guarded.pruneExpiredTasks();
    guarded.pruneExpiredTasks();
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect(interrupt).toHaveBeenCalledWith(task.sessionID);

    confirmAbort(false);
    await vi.waitFor(() => {
        guarded.pruneExpiredTasks();
        expect(interrupt).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(() => expect(task.status).toBe(TASK_STATUS.TIMEOUT));
    guarded.shutdown();
});

it("retries the timeout after an abort request that never settles", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
        const interrupt = vi.fn();
        interrupt.mockImplementationOnce(() => new Promise(() => {}));
        interrupt.mockResolvedValue(true);
        const guarded = new TaskCleaner(createClient({ interrupt }), store, concurrency, createRegistry());
        const task = createTask({ status: TASK_STATUS.RUNNING, startedAt: new Date(Date.now() - PARALLEL_TASK.TTL_MS - 1) });
        store.set(task.id, task);

        guarded.pruneExpiredTasks();
        await vi.advanceTimersByTimeAsync(SESSION_ABORT_TIMEOUT_MS);
        guarded.pruneExpiredTasks();
        await vi.advanceTimersByTimeAsync(0);

        expect(interrupt).toHaveBeenCalledTimes(2);
        await vi.waitFor(() => expect(task.status).toBe(TASK_STATUS.TIMEOUT));
        guarded.shutdown();
    } finally {
        vi.useRealTimers();
    }
});

it("releases the session and deletes a finished task after the cleanup delay", async () => {
    vi.useFakeTimers();
    try {
        const registry = createRegistry();
        const delayed = new TaskCleaner(createClient(), store, concurrency, registry);
        const task = createTask();
        store.set(task.id, task);

        delayed.scheduleCleanup(task.id);
        await vi.advanceTimersByTimeAsync(PARALLEL_TASK.CLEANUP_DELAY_MS - 1);
        expect(store.get(task.id)).toBe(task);

        await vi.advanceTimersByTimeAsync(1);
        expect(registry.release).toHaveBeenCalledWith(task.sessionID);
        expect(store.get(task.id)).toBeUndefined();
    } finally {
        vi.useRealTimers();
    }
});

it("does not clean up a task that was resumed before the delay expired", async () => {
    vi.useFakeTimers();
    try {
        const registry = createRegistry();
        const delayed = new TaskCleaner(createClient(), store, concurrency, registry);
        const task = createTask();
        store.set(task.id, task);

        delayed.scheduleCleanup(task.id);
        task.status = TASK_STATUS.RUNNING;
        task.startedAt = new Date();
        await vi.advanceTimersByTimeAsync(PARALLEL_TASK.CLEANUP_DELAY_MS);

        expect(registry.release).not.toHaveBeenCalled();
        expect(store.get(task.id)).toBe(task);
    } finally {
        vi.useRealTimers();
    }
});

/**
 * Issue #38: a parent agent is very often mid-turn when its background
 * subagents finish. A no-reply write is not safe either — the host still
 * persists the message, so the text lands inside the turn the model is
 * executing.
 */
function cleanerWithStatus(busy: boolean) {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = createClient({
        prompt: send,
        statuses: vi.fn(() => new Map(busy ? [["parent-session", "busy"]] : [])),
    });
    return {
        send,
        cleaner: new TaskCleaner(client, store, concurrency, createRegistry()),
    };
}

describe("busy parent", () => {
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
        expect(store.getNotifications(task.parentSessionID)).toEqual([]);
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
        ...overrides,
    };
}
