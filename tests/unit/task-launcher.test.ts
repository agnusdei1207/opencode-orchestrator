/**
 * Task Launcher Unit Tests
 *
 * Verifies:
 * - Single task launch
 * - Launch errors carry their cause to the caller
 * - Concurrency acquisition logic
 * - Task status transitions (PENDING -> RUNNING)
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import type { RoutedAgentPrompt } from "../../src/core/agents/manager/prompt-routing";
import { TaskLauncher } from "../../src/core/agents/manager/task-launcher";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { AGENT_NAMES, TASK_STATUS } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

describe("TaskLauncher", () => {
    let mockClient: {
        prompt: ReturnType<typeof vi.fn>;
        statuses: ReturnType<typeof vi.fn>;
    };
    let store: TaskStore;
    let concurrency: ConcurrencyController;
    let sessionRegistry: { acquire: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
    let launcher: TaskLauncher;
    let startPolling: Mock<() => void>;
    let onTaskError: Mock<(taskId: string, error: unknown) => void | Promise<void>>;
    let routePrompt: Mock<(agent: string, prompt: string) => Promise<RoutedAgentPrompt>>;
    let nextSession: number;

    function createLauncher(): TaskLauncher {
        return new TaskLauncher({
            client: mockClient as never,
            store,
            concurrency,
            sessionRegistry: sessionRegistry as never,
            onTaskError,
            startPolling,
            routePrompt,
        });
    }

    beforeEach(() => {
        nextSession = 0;
        mockClient = {
            prompt: vi.fn().mockResolvedValue(undefined),
            statuses: vi.fn(() => new Map<string, string>()),
        };
        store = new TaskStore();
        concurrency = new ConcurrencyController({ defaultConcurrency: 2 });

        // Make acquire truly async so the PENDING state is observable
        const originalAcquire = concurrency.acquire.bind(concurrency);
        vi.spyOn(concurrency, "acquire").mockImplementation(async (key) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return originalAcquire(key);
        });

        startPolling = vi.fn();
        onTaskError = vi.fn();
        routePrompt = vi.fn(async (agent: string, prompt: string) => ({
            wireAgent: AGENT_NAMES.COMMANDER,
            text: `routed(${agent}): ${prompt}`,
        }));

        sessionRegistry = {
            acquire: vi.fn().mockImplementation(async (agentName: string) => ({
                id: ++nextSession === 1 ? "new-session-id" : `session-${nextSession}`,
                agentName,
            })),
            release: vi.fn().mockResolvedValue(undefined),
        };

        launcher = createLauncher();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should prepare a task correctly in PENDING status", async () => {
        const task = await launcher.launch({
            description: "Test task",
            prompt: "Test prompt",
            agent: "builder",
            parentSessionID: "parent-123",
        });

        expect(task.status).toBe(TASK_STATUS.PENDING);
        expect(task.sessionID).toBe("new-session-id");
        expect(task.id).toMatch(/^task_/);
        expect(task.depth).toBe(1);
        expect(task.completedAt).toBeUndefined();
        expect(task.error).toBeUndefined();
        expect(task.result).toBeUndefined();
        expect(store.get(task.id)).toBe(task);
        expect(store.getPendingCount("parent-123")).toBe(1);
        expect(sessionRegistry.acquire).toHaveBeenCalledWith("builder", "parent-123", "Test task");
        expect(startPolling).toHaveBeenCalled();
    });

    it("throws with the cause when task preparation fails", async () => {
        sessionRegistry.acquire.mockRejectedValueOnce(new Error("session unavailable"));

        await expect(launcher.launch({
            description: "Test task",
            prompt: "Test prompt",
            agent: "builder",
            parentSessionID: "parent-123",
        })).rejects.toThrow("session unavailable");

        expect(startPolling).not.toHaveBeenCalled();
        expect(store.getAll()).toEqual([]);
        expect(store.getPendingCount("parent-123")).toBe(0);
    });

    it("rejects launches at max depth before acquiring a session", async () => {
        await expect(launcher.launch({
            description: "Too deep",
            prompt: "Test prompt",
            agent: "builder",
            parentSessionID: "parent-123",
            depth: 3,
        })).rejects.toThrow("Maximum task depth");

        expect(sessionRegistry.acquire).not.toHaveBeenCalled();
        expect(store.getAll()).toEqual([]);
    });

    it("should execute tasks in background and transition to RUNNING", async () => {
        await launcher.launch({
            description: "Background task",
            prompt: "Prompt",
            agent: "builder",
            parentSessionID: "p-1",
        });

        await vi.waitFor(() => expect(mockClient.prompt).toHaveBeenCalled());

        const tasks = store.getAll();
        expect(tasks[0].status).toBe(TASK_STATUS.RUNNING);
        expect(tasks[0].concurrencyKey).toBe("builder");
        expect(routePrompt).toHaveBeenCalledWith("builder", "Prompt");
        expect(mockClient.prompt).toHaveBeenCalledWith({
            sessionID: "new-session-id",
            agent: AGENT_NAMES.COMMANDER,
            text: "routed(builder): Prompt",
            synthetic: false,
        });
    });

    it("dispatches a prepared resume prompt as synthetic without rerouting", async () => {
        const task = await launcher.launch({
            description: "Resume",
            prompt: "First",
            agent: AGENT_NAMES.WORKER,
            parentSessionID: "p-1",
        });
        await vi.waitFor(() => expect(mockClient.prompt).toHaveBeenCalledTimes(1));

        task.status = TASK_STATUS.PENDING;
        task.startedAt = new Date();
        launcher.startTask(task, { wireAgent: AGENT_NAMES.WORKER, text: "follow-up" });
        await vi.waitFor(() => expect(mockClient.prompt).toHaveBeenCalledTimes(2));

        expect(routePrompt).toHaveBeenCalledTimes(1);
        expect(mockClient.prompt).toHaveBeenLastCalledWith({
            sessionID: task.sessionID,
            agent: AGENT_NAMES.WORKER,
            text: "follow-up",
            synthetic: true,
        });
    });

    it("refuses to dispatch a resume prompt into a session that became busy", async () => {
        const task = await launcher.launch({
            description: "Resume",
            prompt: "First",
            agent: AGENT_NAMES.WORKER,
            parentSessionID: "p-1",
        });
        await vi.waitFor(() => expect(mockClient.prompt).toHaveBeenCalledTimes(1));

        mockClient.statuses.mockReturnValue(new Map([[task.sessionID, "busy"]]));
        task.status = TASK_STATUS.PENDING;
        task.startedAt = new Date();
        launcher.startTask(task, { wireAgent: AGENT_NAMES.WORKER, text: "follow-up" });

        await vi.waitFor(() => expect(onTaskError).toHaveBeenCalledTimes(1));
        expect(onTaskError.mock.calls[0][1]).toMatchObject({ message: expect.stringContaining("became busy") });
        expect(mockClient.prompt).toHaveBeenCalledTimes(1);
    });

    it("should respect concurrency limits in background", async () => {
        concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
        launcher = createLauncher();

        await launcher.launch({ description: "T1", prompt: "P1", agent: "a", parentSessionID: "p" });
        await launcher.launch({ description: "T2", prompt: "P2", agent: "a", parentSessionID: "p" });
        await vi.waitFor(() => expect(mockClient.prompt).toHaveBeenCalledTimes(1));
        await new Promise(resolve => setTimeout(resolve, 20));

        const tasks = store.getAll();
        expect(tasks).toHaveLength(2);
        expect(tasks.filter(t => t.status === TASK_STATUS.RUNNING)).toHaveLength(1);
        expect(tasks.filter(task => task.status === TASK_STATUS.PENDING)).toHaveLength(1);
        expect(concurrency.getQueueLength("a")).toBe(1);
    });

    it("does not dispatch a queued task after shutdown", async () => {
        concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
        launcher = createLauncher();

        await launcher.launch({ description: "T1", prompt: "P1", agent: "a", parentSessionID: "p" });
        await launcher.launch({ description: "T2", prompt: "P2", agent: "a", parentSessionID: "p" });
        await vi.waitFor(() => expect(mockClient.prompt).toHaveBeenCalledTimes(1));

        launcher.shutdown();
        concurrency.release("a");
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(mockClient.prompt).toHaveBeenCalledTimes(1);
        expect(concurrency.getActiveCount("a")).toBe(0);
    });

    it("should await async task error handlers from background execution", async () => {
        const events: string[] = [];
        mockClient.prompt.mockRejectedValueOnce(new Error("session expired"));
        onTaskError = vi.fn(async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            events.push("handled");
        });
        launcher = createLauncher();

        await launcher.launch({
            description: "Failing task",
            prompt: "Prompt",
            agent: "builder",
            parentSessionID: "parent-123",
        });

        await vi.waitFor(() => {
            expect(events).toEqual(["handled"]);
        });
    });

    it("does not replay a prompt after an ambiguous transport failure", async () => {
        mockClient.prompt.mockRejectedValue(new Error("ECONNREFUSED"));

        const task = await launcher.launch({
            description: "Retrying task",
            prompt: "Prompt",
            agent: "builder",
            parentSessionID: "parent-123",
        });

        await vi.waitFor(() => {
            expect(onTaskError).toHaveBeenCalledTimes(1);
        });
        expect(onTaskError.mock.calls[0][0]).toBe(task.id);
        expect(onTaskError.mock.calls[0][1]).toMatchObject({ message: "ECONNREFUSED" });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(mockClient.prompt).toHaveBeenCalledTimes(1);
    });
});
