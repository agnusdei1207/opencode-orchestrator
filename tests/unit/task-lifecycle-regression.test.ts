import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParallelAgentManager } from "../../src/core/agents/manager";
import { TaskLauncher } from "../../src/core/agents/manager/task-launcher";
import { TaskPoller } from "../../src/core/agents/manager/task-poller";
import { TaskCleaner } from "../../src/core/agents/manager/task-cleaner";
import { TaskResumer } from "../../src/core/agents/manager/task-resumer";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { CONFIG } from "../../src/core/agents/config";
import { TASK_STATUS, type ParallelTask } from "../../src/shared";

vi.mock("../../src/core/agents/manager/prompt-routing", () => ({
    buildRoutedAgentPrompt: vi.fn(async (_agent, text) => ({ wireAgent: "Worker", text, tools: {} })),
}));
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

function createTaskLauncher(
    client: any,
    store: TaskStore,
    concurrency: ConcurrencyController,
    sessionPool: any,
    onTaskError: any,
    startPolling: any,
): TaskLauncher {
    return new TaskLauncher({ client, store, concurrency, sessionPool, onTaskError, startPolling });
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
    let client: { session: { prompt: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; messages: ReturnType<typeof vi.fn> } };
    let pool: { acquire: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.useFakeTimers();
        store = new TaskStore();
        concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
        client = { session: {
            prompt: vi.fn().mockResolvedValue({ data: {} }),
            abort: vi.fn().mockResolvedValue({ data: true }),
            status: vi.fn().mockResolvedValue({ data: { parent: { type: "busy" } } }),
            messages: vi.fn().mockResolvedValue({ data: [] }),
        } };
        let sequence = 0;
        pool = { acquire: vi.fn(async () => ({ id: `session-${++sequence}` })), release: vi.fn().mockResolvedValue(undefined) };
        cleaner = new TaskCleaner(client as never, store, concurrency, pool as never);
        manager = Object.assign(Object.create(ParallelAgentManager.prototype), { client, store, concurrency, cleaner });
        launcher = createTaskLauncher(client, store, concurrency, pool, vi.fn(), vi.fn());
    });

    afterEach(async () => { launcher.shutdown(); cleaner.shutdown(); await concurrency.shutdown(); vi.clearAllTimers(); vi.useRealTimers(); });

    async function launch() {
        return await launcher.launch({ description: "work", prompt: "do work", agent: "Worker", parentSessionID: "parent" }) as ParallelTask;
    }

    it("does not release a second slot when prompt resolution follows observed completion", async () => {
        const request = deferred<object>();
        client.session.prompt.mockReturnValueOnce(request.promise);
        const first = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const second = await launch();
        const third = await launch();
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.completeTask(first);
        request.resolve({ data: {} });
        await vi.advanceTimersByTimeAsync(0);
        expect(second.status).toBe(TASK_STATUS.RUNNING);
        expect(third.status).toBe(TASK_STATUS.PENDING);
        expect(client.session.prompt).toHaveBeenCalledTimes(2);
    });

    it("cancels queued work without releasing another task's slot or later prompting it", async () => {
        client.session.prompt.mockReturnValue(new Promise(() => {}));
        const first = await launch();
        const queued = await launch();
        await vi.advanceTimersByTimeAsync(0);
        expect(await manager.cancelTask(queued.id)).toBe(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(queued.status).not.toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
        expect(client.session.prompt).toHaveBeenCalledTimes(1);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.completeTask(first);
        await vi.advanceTimersByTimeAsync(0);
        expect(client.session.prompt).toHaveBeenCalledTimes(1);
    });

    it.each(["reject", "error", "false"])("retains running state and slot when abort returns %s", async (failure) => {
        client.session.prompt.mockReturnValue(new Promise(() => {}));
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        if (failure === "reject") client.session.abort.mockRejectedValueOnce(new Error("offline"));
        else client.session.abort.mockResolvedValueOnce(failure === "error" ? { error: "offline" } : { data: false });
        expect(await manager.cancelTask(task.id)).toBe(false);
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
        expect(store.hasPending(task.parentSessionID)).toBe(true);
    });

    it("does not clean a task that resumed before its old retention timer", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.status = TASK_STATUS.COMPLETED;
        cleaner.scheduleCleanup(task.id);
        task.startedAt = new Date(Date.now() + 1);
        task.status = TASK_STATUS.RUNNING;
        await vi.advanceTimersByTimeAsync(CONFIG.CLEANUP_DELAY_MS);
        expect(store.get(task.id)).toBe(task);
        expect(pool.release).not.toHaveBeenCalled();
    });

    it("does not complete busy work based on stable message counts", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.session.status.mockResolvedValue({ data: { [task.sessionID]: { type: "busy", messageCount: 1 } } });
        client.session.messages.mockResolvedValue({ data: [{ info: { role: "assistant", time: { created: Date.now(), completed: Date.now() }, finish: "stop" }, parts: [{ type: "text", text: "still working" }] }] });
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        for (let i = 0; i < 5; i++) await poller.poll();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
    });

    it("does not use a previous run's output to complete a resumed idle session", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.session.status.mockResolvedValue({ data: { [task.sessionID]: { type: "idle" } } });
        client.session.messages.mockResolvedValue({ data: [{ info: { role: "assistant", time: { created: task.startedAt.getTime() - 1, completed: Date.now() }, finish: "stop" }, parts: [{ type: "text", text: "old result" }] }] });
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.poll();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
    });

    it("completes current terminal output when idle sessions are omitted from the status map", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - 20_000);
        client.session.status.mockResolvedValue({ data: {} });
        client.session.messages.mockResolvedValue({ data: [{ info: { role: "assistant", time: { created: Date.now(), completed: Date.now() }, finish: "stop" }, parts: [{ type: "text", text: "current result" }] }] });
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        await poller.poll();
        expect(task.status).toBe(TASK_STATUS.COMPLETED);
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
        client.session.status.mockRejectedValue(new Error("offline"));
        client.session.abort.mockResolvedValue({ data: false });
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), vi.fn(), vi.fn());
        for (let i = 0; i < 3; i++) await poller.poll();
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
        expect(store.hasPending(task.parentSessionID)).toBe(true);
    });

    it("does not time out remote work without confirmed abort", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.startedAt = new Date(Date.now() - CONFIG.TASK_TTL_MS - 1);
        client.session.abort.mockResolvedValue({ data: false });
        cleaner.pruneExpiredTasks();
        await vi.advanceTimersByTimeAsync(0);
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(concurrency.getActiveCount("Worker")).toBe(1);
    });

    it("resumes through the same admission queue and cancels previous cleanup", async () => {
        concurrency.configure({ defaultConcurrency: 1, acquisitionTimeoutMs: 2 * CONFIG.CLEANUP_DELAY_MS });
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const poller = createTaskPoller(client, store, concurrency, vi.fn(), id => cleaner.scheduleCleanup(id), vi.fn());
        await poller.completeTask(task);
        const blocker = await launch();
        await vi.advanceTimersByTimeAsync(0);
        const resumer = new TaskResumer(client as never, store, id => store.getBySession(id),
            (resumed, prompt) => { cleaner.cancelCleanup(resumed.id); launcher.startTask(resumed, prompt); });
        Object.assign(manager, { resumer });
        const run = await manager.resume({ sessionId: task.sessionID, prompt: "follow up", parentSessionID: "parent" });
        expect(run.status).toBe(TASK_STATUS.PENDING);
        await vi.advanceTimersByTimeAsync(CONFIG.CLEANUP_DELAY_MS);
        expect(store.get(task.id)).toBe(task);
        expect(pool.release).not.toHaveBeenCalled();
        await poller.completeTask(blocker);
        await vi.advanceTimersByTimeAsync(0);
        expect(task.status).toBe(TASK_STATUS.RUNNING);
        expect(client.session.prompt).toHaveBeenLastCalledWith(expect.objectContaining({
            path: { id: task.sessionID },
            body: expect.objectContaining({ parts: [{ type: "text", text: "follow up", synthetic: true }] }),
        }));
    });

    it("does not cache failed fetches or results arriving after a resume", async () => {
        const task = await launch();
        await vi.advanceTimersByTimeAsync(0);
        task.status = TASK_STATUS.COMPLETED;
        client.session.messages.mockResolvedValueOnce({ error: "offline" });
        await expect(manager.getResult(task.id)).rejects.toThrow("offline");
        expect(task.result).toBeUndefined();
        const response = deferred<object>();
        client.session.messages.mockReturnValueOnce(response.promise);
        const result = manager.getResult(task.id);
        const previousStart = task.startedAt;
        task.startedAt = new Date(previousStart.getTime() + 1);
        task.status = TASK_STATUS.PENDING;
        response.resolve({ data: [{ info: { role: "assistant", time: { created: previousStart.getTime(), completed: previousStart.getTime() + 1 } }, parts: [{ type: "text", text: "old result" }] }] });
        expect(await result).toBeNull();
        expect(task.result).toBeUndefined();
        expect(await manager.getResult(task.id)).toBeNull();
    });
});
