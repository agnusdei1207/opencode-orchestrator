import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParallelAgentManager } from "../../src/core/agents/manager";
import { TaskLauncher } from "../../src/core/agents/manager/task-launcher";
import { TaskPoller } from "../../src/core/agents/manager/task-poller";
import { EventHandler } from "../../src/core/agents/manager/event-handler";
import { TaskCleaner } from "../../src/core/agents/manager/task-cleaner";
import { TaskResumer } from "../../src/core/agents/manager/task-resumer";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { PARALLEL_TASK, TASK_STATUS, type ParallelTask } from "../../src/shared";
import type { HostMessage } from "../../src/host/client";

const routePrompt = vi.fn(async (_agent: string, text: string) => ({ wireAgent: "Worker", text }));
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

function assistant(overrides: Partial<HostMessage>): HostMessage {
    return { id: "msg", role: "assistant", text: "", toolCallCount: 0, ...overrides };
}

function createTaskLauncher(
    client: any,
    store: TaskStore,
    concurrency: ConcurrencyController,
    sessionRegistry: any,
    onTaskError: any,
    startPolling: any,
): TaskLauncher {
    return new TaskLauncher({ client, store, concurrency, sessionRegistry, onTaskError, startPolling, routePrompt });
}

function createTaskPoller(
    client: any,
    store: TaskStore,
    concurrency: ConcurrencyController,
    notifyParentIfAllComplete: any,
    scheduleCleanup: any,
    pruneExpiredTasks: any,
): TaskPoller {
    return new TaskPoller({
        client,
        store,
        concurrency,
        notifyParentIfAllComplete,
        scheduleCleanup,
        pruneExpiredTasks,
    });
}

describe("task lifecycle across execution boundaries", () => {
    let store: TaskStore;
    let concurrency: ConcurrencyController;
    let launcher: TaskLauncher;
    let cleaner: TaskCleaner;
    let manager: ParallelAgentManager;
    let client: {
        prompt: ReturnType<typeof vi.fn>;
        interrupt: ReturnType<typeof vi.fn>;
        statuses: ReturnType<typeof vi.fn>;
        messages: ReturnType<typeof vi.fn>;
    };
    let registry: { acquire: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.useFakeTimers();
        store = new TaskStore();
        // Queued resumes may wait longer than a cleanup delay for their slot.
        concurrency = new ConcurrencyController({ defaultConcurrency: 1, acquisitionTimeoutMs: 2 * PARALLEL_TASK.CLEANUP_DELAY_MS });
        client = {
            prompt: vi.fn().mockResolvedValue(undefined),
            interrupt: vi.fn().mockResolvedValue(true),
            statuses: vi.fn(() => new Map([["parent", "busy"]])),
            messages: vi.fn().mockResolvedValue([]),
        };
        let sequence = 0;
        registry = { acquire: vi.fn(async () => ({ id: `session-${++sequence}` })), release: vi.fn().mockResolvedValue(undefined) };
        cleaner = new TaskCleaner(client as never, store, concurrency, registry as never);
        manager = Object.assign(Object.create(ParallelAgentManager.prototype), { client, store, concurrency, cleaner });
        launcher = createTaskLauncher(client, store, concurrency, registry, vi.fn(), vi.fn());
    });

    afterEach(async () => { launcher.shutdown(); cleaner.shutdown(); await concurrency.shutdown(); vi.clearAllTimers(); vi.useRealTimers(); });

    async function launch() {
        return await launcher.launch({ description: "work", prompt: "do work", agent: "Worker", parentSessionID: "parent" }) as ParallelTask;
    }

    it("does not release a second slot when prompt resolution follows observed completion", async () => {
        const request = deferred<void>();
        client.prompt.mockReturnValueOnce(request.promise);
        const first = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const second = await launch();
        const third = await launch();
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.completeTask(first);
        request.resolve();
        await vi.advanceTimersByTimeAsync(0);
        expect(second.status).toBe(TASK_STATUS.RUNNING);
        expect(third.status).toBe(TASK_STATUS.PENDING);
        expect(client.prompt).toHaveBeenCalledTimes(2);
    });

    it("cancels queued work without releasing another task's slot or later prompting it", async () => {
        client.prompt.mockReturnValue(new Promise(() => {}));
        const first = await launch();
        const queued = await launch();
        await vi.advanceTimersByTimeAsync(0);
        expect(await manager.cancelTask(queued.id)).toBe(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(queued.status).not.toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
        expect(client.prompt).toHaveBeenCalledTimes(1);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.completeTask(first);
        await vi.advanceTimersByTimeAsync(0);
        expect(client.prompt).toHaveBeenCalledTimes(1);
    });

    it("silently retires a prior mission's child tasks during replacement", async () => {
        client.prompt.mockReturnValue(new Promise(() => {}));
        const running = await launch();
        const queued = await launch();
        await vi.advanceTimersByTimeAsync(0);
        store.queueNotification(running);

        expect(await manager.cancelTasksForParent("parent")).toBe(true);
        expect(running.status).toBe(TASK_STATUS.ERROR);
        expect(queued.status).toBe(TASK_STATUS.ERROR);
        expect(store.getNotifications("parent")).toEqual([]);
        expect(client.prompt).toHaveBeenCalledTimes(1);
    });

    it("keeps the prior mission when a child session cannot be aborted", async () => {
        client.prompt.mockReturnValue(new Promise(() => {}));
        const running = await launch();
        await vi.advanceTimersByTimeAsync(0);
        client.interrupt.mockResolvedValueOnce(false);

        expect(await manager.cancelTasksForParent("parent")).toBe(false);
        expect(running.status).toBe(TASK_STATUS.RUNNING);
    });

    it.each(["reject", "false"])("retains running state and slot when abort returns %s", async (failure) => {
        client.prompt.mockReturnValue(new Promise(() => {}));
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        if (failure === "reject") client.interrupt.mockRejectedValueOnce(new Error("offline"));
        else client.interrupt.mockResolvedValueOnce(false);
        expect(await manager.cancelTask(task.id)).toBe(false);
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
        expect(store.getPendingCount(task.parentSessionID)).toBe(1);
    });

    it("reports a successful cancel when the interruption event arrives before abort resolves", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const handler = new EventHandler({
            store, concurrency, findBySession: id => store.getBySession(id),
            notifyParentIfAllComplete: vi.fn().mockResolvedValue(undefined),
            scheduleCleanup: vi.fn(), validateSessionHasOutput: vi.fn().mockResolvedValue(false),
        });
        client.interrupt.mockImplementationOnce(async () => {
            handler.handle({ type: "session.execution.interrupted", properties: { sessionID: task.sessionID } });
            return true;
        });

        expect(await manager.cancelTask(task.id)).toBe(true);
        expect(task.status).toBe(TASK_STATUS.ERROR);
        expect(concurrency.getActiveCount("Worker")).toBe(0);
    });

    it("does not clean a task that resumed before its old retention timer", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.status = TASK_STATUS.COMPLETED;
        cleaner.scheduleCleanup(task.id);
        task.startedAt = new Date(Date.now() + 1);
        task.status = TASK_STATUS.RUNNING;
        await vi.advanceTimersByTimeAsync(PARALLEL_TASK.CLEANUP_DELAY_MS);
        expect(store.get(task.id)).toBe(task);
        expect(registry.release).not.toHaveBeenCalled();
    });

    it("does not complete busy work even when its latest message looks terminal", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.statuses.mockReturnValue(new Map([[task.sessionID, "busy"]]));
        client.messages.mockResolvedValue([assistant({ created: Date.now(), completed: Date.now(), finish: "stop", text: "still working" })]);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        for (let i = 0; i < 5; i++) await poller.poll();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
    });

    it("does not use a previous run's output to complete a resumed idle session", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.statuses.mockReturnValue(new Map());
        client.messages.mockResolvedValue([assistant({ created: task.startedAt.getTime() - 1, completed: Date.now(), finish: "stop", text: "old result" })]);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.poll();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
    });

    it("completes current terminal output when idle sessions are omitted from the status map", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.statuses.mockReturnValue(new Map());
        client.messages.mockResolvedValue([assistant({ created: Date.now(), completed: Date.now(), finish: "stop", text: "current result" })]);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.poll();
        expect(task.status).toBe(TASK_STATUS.COMPLETED);
    });

    it("does not complete output whose terminal finish is an error", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.statuses.mockReturnValue(new Map());
        client.messages.mockResolvedValue([assistant({ created: Date.now(), completed: Date.now(), finish: "error", text: "partial output" })]);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());

        await poller.poll();

        expect(task.status).toBe(TASK_STATUS.RUNNING);
    });

    it("treats zero default concurrency as unlimited", async () => {
        const unlimited = new ConcurrencyController({ defaultConcurrency: 0 });
        expect(unlimited.getConcurrencyLimit("Worker")).toBe(Infinity);
        await unlimited.acquire("Worker");
        expect(unlimited.getQueueLength("Worker")).toBe(0);
    });

    it("keeps remote work running when polling fails and abort cannot be confirmed", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.statuses.mockReturnValue(new Map());
        client.messages.mockRejectedValue(new Error("offline"));
        client.interrupt.mockResolvedValue(false);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        for (let i = 0; i < 3; i++) await poller.poll();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
        expect(store.getPendingCount(task.parentSessionID)).toBe(1);
    });

    it("does not time out remote work without confirmed abort", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - PARALLEL_TASK.TTL_MS - 1);
        client.interrupt.mockResolvedValue(false);
        cleaner.pruneExpiredTasks();
        await vi.advanceTimersByTimeAsync(0);
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
    });

    it("resumes through the same admission queue and cancels previous cleanup", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), id => cleaner.scheduleCleanup(id), vi.fn());
        await poller.completeTask(task);
        const blocker = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const resumer = new TaskResumer(client as never, store, id => store.getBySession(id),
            (resumed, prompt) => { cleaner.cancelCleanup(resumed.id); launcher.startTask(resumed, prompt); }, routePrompt);
        Object.assign(manager, { resumer });
        const run = await manager.resume({ sessionId: task.sessionID, prompt: "follow up", parentSessionID: "parent" });
        expect(run.status).toBe(TASK_STATUS.PENDING);
        await vi.advanceTimersByTimeAsync(PARALLEL_TASK.CLEANUP_DELAY_MS);
        expect(store.get(task.id)).toBe(task);
        expect(registry.release).not.toHaveBeenCalled();
        await poller.completeTask(blocker);
        await vi.advanceTimersByTimeAsync(0);
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(client.prompt).toHaveBeenLastCalledWith({
            sessionID: task.sessionID,
            agent: "Worker",
            text: "follow up",
            synthetic: true,
        });
    });

    it("does not cache failed fetches or results arriving after a resume", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.status = TASK_STATUS.COMPLETED;
        client.messages.mockRejectedValueOnce(new Error("offline"));
        await expect(manager.getResult(task.id)).rejects.toThrow("offline");
        expect(task.result).toBeUndefined();
        const response = deferred<HostMessage[]>();
        client.messages.mockReturnValueOnce(response.promise);
        const result = manager.getResult(task.id);
        const previousStart = task.startedAt;
        task.startedAt = new Date(previousStart.getTime() + 1);
        task.status = TASK_STATUS.PENDING;
        response.resolve([assistant({ created: previousStart.getTime(), completed: previousStart.getTime() + 1, text: "old result" })]);
        expect(await result).toBeNull();
        expect(task.result).toBeUndefined();
        expect(await manager.getResult(task.id)).toBeNull();
    });
});
