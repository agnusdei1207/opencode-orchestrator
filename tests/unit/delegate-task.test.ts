import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presets } from "../../src/core/notification/toast";
import { createDelegateTaskTool } from "../../src/tools/parallel/delegate-task";
import type { ParallelAgentManager } from "../../src/core/agents/manager";
import type { ParallelTask } from "../../src/shared/index";

vi.mock("@opencode-ai/plugin", () => {
    const schemaValue = {
        optional: () => schemaValue,
        describe: () => schemaValue,
    };
    const mockSchema = {
        string: () => schemaValue,
        boolean: () => schemaValue,
        number: () => schemaValue,
        array: () => schemaValue,
        enum: () => schemaValue,
        object: () => schemaValue,
    };
    const mockTool = vi.fn((config: unknown) => config) as unknown as {
        schema: typeof mockSchema;
    };
    mockTool.schema = mockSchema;
    return { tool: mockTool };
});

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

vi.mock("../../src/core/notification/toast", () => ({
    presets: {
        taskStarted: vi.fn(),
    },
}));

interface ManagerOptions {
    tasks?: ParallelTask[];
    launchResult?: ParallelTask | ParallelTask[] | null;
    launchError?: Error;
    resumeResult?: ParallelTask | null;
    resumeError?: Error;
}

function makeTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: "task-1",
        sessionID: "session-1",
        parentSessionID: "parent-session",
        description: "Task",
        prompt: "Prompt",
        agent: "Worker",
        status: "running",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        depth: 1,
        ...overrides,
    };
}

function createManager(options: ManagerOptions = {}) {
    const launch = vi.fn();
    const resume = vi.fn();
    const tasks = options.tasks ?? [];

    if (options.launchError) {
        launch.mockRejectedValue(options.launchError);
    } else if ("launchResult" in options) {
        launch.mockResolvedValue(options.launchResult);
    } else {
        launch.mockResolvedValue(makeTask());
    }

    if (options.resumeError) {
        resume.mockRejectedValue(options.resumeError);
    } else if ("resumeResult" in options) {
        resume.mockResolvedValue(options.resumeResult);
    } else {
        resume.mockResolvedValue(makeTask());
    }

    return {
        getAllTasks: vi.fn(() => tasks),
        getTaskBySession: vi.fn((sessionID: string) => tasks.find(task => task.sessionID === sessionID)),
        launch,
        resume,
    };
}

function createClient(status = vi.fn(), messages = vi.fn()) {
    return {
        session: {
            status,
            messages,
        },
    };
}

function createTool(manager: ReturnType<typeof createManager>, client = createClient()) {
    return createDelegateTaskTool(manager as unknown as ParallelAgentManager, client);
}

function assistantTextMessages(text: string, type = "text") {
    return [{
        info: { role: "assistant" },
        parts: [{ type, text }],
    }];
}

function assistantToolMessages() {
    return [{
        info: { role: "assistant" },
        parts: [{ type: "tool" }],
    }];
}

async function waitForPolling<T>(promise: Promise<T>, ms = 12_000): Promise<T> {
    await vi.advanceTimersByTimeAsync(ms);
    return promise;
}

describe("createDelegateTaskTool", () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("routes resume requests through manager.resume without launching a new task", async () => {
        const resumedTask = makeTask({
            id: "task-existing",
            sessionID: "session-existing",
            description: "Existing task",
            prompt: "Old prompt",
        });
        const manager = createManager({ resumeResult: resumedTask });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Continue existing task",
                prompt: "Continue from prior state",
                background: true,
                resume: "session-existing",
            },
            { sessionID: "parent-session" },
        );

        expect(manager.resume).toHaveBeenCalledWith({
            sessionId: "session-existing",
            prompt: "Continue from prior state",
            parentSessionID: "parent-session",
        });
        expect(manager.launch).not.toHaveBeenCalled();
        expect(result).toContain("session-existing");
    });

    it("does not treat message fetch failures as valid sync output", async () => {
        vi.useFakeTimers();
        const launchedTask = makeTask({
            id: "task-sync",
            sessionID: "session-sync",
            description: "Sync task",
            prompt: "Do sync work",
        });
        const status = vi.fn().mockResolvedValue({ data: { "session-sync": { type: "idle" } } });
        const messages = vi.fn().mockRejectedValue(new Error("messages unavailable"));
        const manager = createManager({ launchResult: launchedTask });
        const client = createClient(status, messages);
        const delegateTask = createTool(manager, client);

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Run sync task",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        const result = await resultPromise;

        expect(result).toContain("TIMEOUT");
        expect(result).not.toContain("DONE");
        expect(client.session.messages).toHaveBeenCalled();
    });

    it("blocks delegation from terminal-depth parent tasks before launching", async () => {
        const parentTask = makeTask({ sessionID: "parent-session", depth: 2 });
        const manager = createManager({ tasks: [parentTask] });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Nested task",
                prompt: "Do nested work",
                background: true,
            },
            { sessionID: "parent-session" },
        );

        expect(result).toContain("Delegation blocked");
        expect(result).toContain("terminal node");
        expect(manager.getTaskBySession).toHaveBeenCalledWith("parent-session");
        expect(manager.getAllTasks).not.toHaveBeenCalled();
        expect(manager.launch).not.toHaveBeenCalled();
        expect(manager.resume).not.toHaveBeenCalled();
    });

    it("requires an explicit background parameter before dispatch", async () => {
        const manager = createManager();
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Missing mode",
                prompt: "Do work",
            },
            { sessionID: "parent-session" },
        );

        expect(result).toContain("'background' parameter is REQUIRED");
        expect(manager.launch).not.toHaveBeenCalled();
        expect(manager.resume).not.toHaveBeenCalled();
    });

    it("launches new background tasks with depth, mode, and group payload", async () => {
        const task = makeTask({ id: "task-bg", sessionID: "session-bg", agent: "Planner" });
        const manager = createManager({ launchResult: [task] });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Planner",
                description: "Plan work",
                prompt: "Plan this",
                background: true,
                mode: "race",
                groupID: "group-1",
            },
            { sessionID: "parent-session" },
        );

        expect(manager.launch).toHaveBeenCalledWith({
            agent: "Planner",
            description: "Plan work",
            prompt: "Plan this",
            parentSessionID: "parent-session",
            mode: "race",
            groupID: "group-1",
            depth: 0,
        });
        expect(presets.taskStarted).toHaveBeenCalledWith("task-bg", "Planner");
        expect(result).toContain("[SPAWNED]");
        expect(result).toContain("session-bg");
    });

    it("returns a formatted background launch error when manager.launch fails", async () => {
        const manager = createManager({ launchError: new Error("launch failed") });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Launch failure",
                prompt: "Do work",
                background: true,
            },
            { sessionID: "parent-session" },
        );

        expect(result).toBe("[ERROR] Failed: launch failed");
        expect(presets.taskStarted).not.toHaveBeenCalled();
    });

    it("reports background launch failure when manager returns no task", async () => {
        const manager = createManager({ launchResult: null });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "No background task",
                prompt: "Do work",
                background: true,
            },
            { sessionID: "parent-session" },
        );

        expect(result).toBe("[ERROR] Failed to launch task: No background task");
        expect(presets.taskStarted).not.toHaveBeenCalled();
    });

    it("returns a formatted resume error when manager.resume fails", async () => {
        const manager = createManager({ resumeError: new Error("resume failed") });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Resume failure",
                prompt: "Continue",
                background: true,
                resume: "session-existing",
            },
            { sessionID: "parent-session" },
        );

        expect(result).toBe("[ERROR] Resume failed: resume failed");
        expect(manager.launch).not.toHaveBeenCalled();
    });

    it("reports a missing resumed task without launching a replacement", async () => {
        const manager = createManager({ resumeResult: null });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Missing resume task",
                prompt: "Continue",
                background: true,
                resume: "session-missing",
            },
            { sessionID: "parent-session" },
        );

        expect(result).toBe("Failed to resume task: Missing resume task");
        expect(manager.launch).not.toHaveBeenCalled();
    });

    it("waits for resumed sync tasks and returns assistant text", async () => {
        vi.useFakeTimers();
        const task = makeTask({ id: "task-resume", sessionID: "session-resume" });
        const status = vi.fn().mockResolvedValue({ data: { "session-resume": { type: "idle" } } });
        const messages = vi.fn().mockResolvedValue({ data: assistantTextMessages("Resumed output", "reasoning") });
        const manager = createManager({ resumeResult: task });
        const delegateTask = createTool(manager, createClient(status, messages));

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Resume sync",
                prompt: "Continue",
                background: false,
                resume: "session-resume",
            },
            { sessionID: "parent-session" },
        );

        const result = await waitForPolling(resultPromise);
        expect(result).toContain("[RESUMED & DONE]");
        expect(result).toContain("Resumed output");
        expect(manager.launch).not.toHaveBeenCalled();
    });

    it("times out resumed sync tasks that never produce assistant content", async () => {
        vi.useFakeTimers();
        const task = makeTask({ id: "task-resume", sessionID: "session-resume" });
        const status = vi.fn().mockResolvedValue({ data: { "session-resume": { type: "idle" } } });
        const messages = vi.fn().mockResolvedValue({ data: [] });
        const manager = createManager({ resumeResult: task });
        const delegateTask = createTool(manager, createClient(status, messages));

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Resume timeout",
                prompt: "Continue",
                background: false,
                resume: "session-resume",
            },
            { sessionID: "parent-session" },
        );

        const result = await waitForPolling(resultPromise, 5 * 60 * 1000);
        expect(result).toContain("[TIMEOUT]");
        expect(result).toContain("session-resume");
    });

    it("waits through transient sync statuses before returning final output", async () => {
        vi.useFakeTimers();
        const task = makeTask({ id: "task-sync", sessionID: "session-sync" });
        const status = vi.fn()
            .mockRejectedValueOnce(new Error("status unavailable"))
            .mockResolvedValueOnce({ data: {} })
            .mockResolvedValueOnce({ data: { "session-sync": { type: "busy" } } })
            .mockResolvedValue({ data: { "session-sync": { type: "idle" } } });
        const messages = vi.fn().mockResolvedValue({ data: assistantTextMessages("Final output") });
        const manager = createManager({ launchResult: task });
        const delegateTask = createTool(manager, createClient(status, messages));

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Run sync task",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        const result = await waitForPolling(resultPromise, 16_000);
        expect(result).toContain("[DONE]");
        expect(result).toContain("Task: `task-sync`");
        expect(result).toContain("Final output");
    });

    it("aborts sync polling before the next status check", async () => {
        const controller = new AbortController();
        const task = makeTask({ id: "task-abort", sessionID: "session-abort" });
        const status = vi.fn().mockResolvedValue({ data: { "session-abort": { type: "busy" } } });
        const messages = vi.fn().mockResolvedValue({ data: [] });
        const manager = createManager({ launchResult: task });
        const delegateTask = createTool(manager, createClient(status, messages));

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Abort sync task",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session", abort: controller.signal },
        );

        controller.abort();
        const result = await resultPromise;

        expect(result).toContain("[ERROR] Polling aborted");
        expect(status).not.toHaveBeenCalled();
        expect(messages).not.toHaveBeenCalled();
    });

    it("accepts assistant tool activity as valid sync output", async () => {
        vi.useFakeTimers();
        const task = makeTask({ id: "task-tool", sessionID: "session-tool" });
        const status = vi.fn().mockResolvedValue({ data: { "session-tool": { type: "idle" } } });
        const messages = vi.fn().mockResolvedValue({ data: assistantToolMessages() });
        const manager = createManager({ launchResult: task });
        const delegateTask = createTool(manager, createClient(status, messages));

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Run tool task",
                prompt: "Use a tool",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        const result = await waitForPolling(resultPromise);
        expect(result).toContain("[DONE]");
        expect(result).toContain("(No output)");
    });

    it("returns an extraction error placeholder after stable sync completion", async () => {
        vi.useFakeTimers();
        const task = makeTask({ id: "task-extract", sessionID: "session-extract" });
        const status = vi.fn().mockResolvedValue({ data: { "session-extract": { type: "idle" } } });
        const output = { data: assistantTextMessages("Intermediate output") };
        const messages = vi.fn()
            .mockResolvedValueOnce(output)
            .mockResolvedValueOnce(output)
            .mockResolvedValueOnce(output)
            .mockRejectedValueOnce(new Error("extract unavailable"));
        const manager = createManager({ launchResult: task });
        const delegateTask = createTool(manager, createClient(status, messages));

        const resultPromise = delegateTask.execute(
            {
                agent: "Worker",
                description: "Extract failure",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        const result = await waitForPolling(resultPromise);
        expect(result).toContain("[DONE]");
        expect(result).toContain("(Error extracting result)");
    });

    it("reports sync launch failure when manager returns no task", async () => {
        const manager = createManager({ launchResult: null });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "No task",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        expect(result).toBe("[ERROR] Failed to launch task: No task");
    });

    it("returns a formatted sync launch error when manager.launch rejects", async () => {
        const manager = createManager({ launchError: new Error("sync launch failed") });
        const delegateTask = createTool(manager);

        const result = await delegateTask.execute(
            {
                agent: "Worker",
                description: "Sync failure",
                prompt: "Do sync work",
                background: false,
            },
            { sessionID: "parent-session" },
        );

        expect(result).toBe("[ERROR] Failed: sync launch failed");
    });
});
