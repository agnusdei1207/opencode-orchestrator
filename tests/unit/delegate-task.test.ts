import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDelegateTaskTool } from "../../src/tools/parallel/delegate-task.js";
import type { ParallelAgentManager } from "../../src/core/agents/manager.js";
import type { ParallelTask } from "../../src/shared/index.js";

vi.mock("../../src/core/notification/toast.js", () => ({ presets: { taskStarted: vi.fn() } }));

const args = { agent: "Worker", description: "Scoped work", prompt: "Implement and verify", background: true };
function setup(status: ParallelTask["status"] = "running") {
    const task: ParallelTask = {
        id: "task-1", sessionID: "child", parentSessionID: "parent", agent: "Worker",
        description: args.description, prompt: args.prompt, status, startedAt: new Date(), depth: 1,
    };
    const manager = {
        launch: vi.fn().mockResolvedValue(task), resume: vi.fn().mockResolvedValue(task),
        getTask: vi.fn().mockImplementation(() => task), getTaskBySession: vi.fn(),
        getResult: vi.fn().mockResolvedValue("Verified output"),
    };
    const tool = createDelegateTaskTool(manager as unknown as ParallelAgentManager);
    const run = (overrides = {}, signal?: AbortSignal) => tool.execute(
        { ...args, ...overrides }, { sessionID: "parent", abort: signal } as never,
    );
    return { task, manager, run };
}

describe("delegate_task manager boundary", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

    it.each([{ background: true }, { background: false }, { background: true, resume: "child" }])("does not dispatch an already aborted call: %j", async (overrides) => {
        const { manager, run } = setup();
        const signal = AbortSignal.abort();
        expect(await run(overrides, signal)).toContain("[ERROR]");
        expect(manager.launch).not.toHaveBeenCalled();
        expect(manager.resume).not.toHaveBeenCalled();
    });

    it("launches a scoped background task with parent and mode metadata", async () => {
        const { manager, run } = setup();
        const result = await run({ mode: "race", groupID: "group" });
        expect(manager.launch).toHaveBeenCalledWith({ agent: args.agent, description: args.description, prompt: args.prompt,
            parentSessionID: "parent", mode: "race", groupID: "group", depth: 0 });
        expect(result).toContain("[SPAWNED]");
        expect(result).toContain("child");
    });

    it("resumes the existing session without launching a replacement", async () => {
        const { manager, run } = setup();
        expect(await run({ resume: "child" })).toContain("[RESUME]");
        expect(manager.resume).toHaveBeenCalledWith({ sessionId: "child", prompt: args.prompt, parentSessionID: "parent" });
        expect(manager.launch).not.toHaveBeenCalled();
    });

    it("blocks terminal-depth delegation", async () => {
        const { manager, run } = setup();
        manager.getTaskBySession.mockReturnValue({ depth: 2 });
        expect(await run()).toContain("Delegation blocked");
        expect(manager.launch).not.toHaveBeenCalled();
    });

    it.each([
        { background: undefined }, { agent: "" }, { description: "" }, { prompt: "" },
        { background: "true" }, { resume: "" }, { mode: "unknown" }, { groupID: "" },
    ])("rejects invalid arguments before creating work: %j", async (overrides) => {
        const { manager, run } = setup();
        expect(await run(overrides)).toContain("[ERROR]");
        expect(manager.launch).not.toHaveBeenCalled();
        expect(manager.resume).not.toHaveBeenCalled();
    });

    it.each([true, false])("reports failed launch in background=%s", async (background) => {
        const { manager, run } = setup();
        manager.launch.mockRejectedValue(new Error("launch unavailable"));
        expect(await run({ background })).toContain("[ERROR] Failed: launch unavailable");
    });

    it("handles empty batch and missing resume without creating substitute work", async () => {
        const { manager, run } = setup();
        manager.launch.mockResolvedValue([]);
        expect(await run()).toContain("[ERROR] Failed to launch task");
        manager.resume.mockRejectedValue(new Error("missing session"));
        expect(await run({ resume: "missing" })).toContain("[ERROR] Resume failed: missing session");
        expect(manager.launch).toHaveBeenCalledTimes(1);
    });

    it("waits for manager completion through queued and running states", async () => {
        const { manager, task, run } = setup("pending");
        const pending = run({ background: false });
        await vi.advanceTimersByTimeAsync(4000);
        expect(manager.getResult).not.toHaveBeenCalled();
        task.status = "running";
        await vi.advanceTimersByTimeAsync(4000);
        expect(manager.getResult).not.toHaveBeenCalled();
        task.status = "completed";
        await vi.advanceTimersByTimeAsync(4000);
        expect(await pending).toContain("[DONE]");
        expect(await pending).toContain("Verified output");
    });

    it("uses the same completion authority for resumed synchronous work", async () => {
        const { task, run } = setup();
        const pending = run({ background: false, resume: "child" });
        await vi.advanceTimersByTimeAsync(4000);
        task.status = "completed";
        await vi.advanceTimersByTimeAsync(4000);
        expect(await pending).toContain("[RESUMED & DONE]");
    });

    it.each(["error", "cancelled", "timeout", "failed"] as const)("does not label %s as done", async (status) => {
        const { task, manager, run } = setup();
        task.status = status;
        task.error = "unfinished work";
        const pending = run({ background: false });
        await vi.advanceTimersByTimeAsync(4000);
        expect(await pending).not.toContain("DONE");
        expect(await pending).toContain("unfinished work");
        expect(manager.getResult).not.toHaveBeenCalled();
    });

    it("keeps a bounded wait and returns retrievable task identity on timeout", async () => {
        const { run } = setup();
        const pending = run({ background: false });
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        expect(await pending).toContain("[TIMEOUT]");
        expect(await pending).toContain("task-1");
    });

    it("stops an interrupted wait without claiming the background task was cancelled", async () => {
        const { manager, run } = setup();
        const controller = new AbortController();
        const pending = run({ background: false }, controller.signal);
        await vi.advanceTimersByTimeAsync(10);
        controller.abort();
        expect(await pending).toContain("Polling aborted");
        expect(manager.getResult).not.toHaveBeenCalled();
    });

    it("reports result retrieval failure instead of a successful placeholder", async () => {
        const { manager, run } = setup("completed");
        manager.getResult.mockRejectedValue(new Error("result unavailable"));
        const pending = run({ background: false });
        await vi.advanceTimersByTimeAsync(4000);
        expect(await pending).toContain("[ERROR]");
        expect(await pending).not.toContain("DONE");
    });

    it.each(["abort", "timeout"])("bounds a hung result retrieval by %s", async (boundary) => {
        const { manager, run } = setup("completed");
        manager.getResult.mockReturnValue(new Promise(() => {}));
        const controller = new AbortController();
        let settled = false;
        const pending = run({ background: false }, controller.signal).then(result => { settled = true; return result; });
        await vi.advanceTimersByTimeAsync(10);
        if (boundary === "abort") controller.abort();
        await vi.advanceTimersByTimeAsync(boundary === "timeout" ? 5 * 60 * 1000 : 10);
        expect(settled).toBe(true);
        expect(await pending).not.toContain("DONE");
    });

    it("does not accept a concurrent resumed run as the original completion", async () => {
        const { task, run } = setup();
        const pending = run({ background: false });
        await vi.advanceTimersByTimeAsync(4000);
        task.startedAt = new Date();
        task.status = "completed";
        await vi.advanceTimersByTimeAsync(4000);
        expect(await pending).toContain("[ERROR]");
        expect(await pending).not.toContain("DONE");
    });

    it("reports removed task state rather than inferring success", async () => {
        const { manager, run } = setup();
        manager.getTask.mockReturnValue(undefined);
        const pending = run({ background: false });
        await vi.advanceTimersByTimeAsync(4000);
        expect(await pending).toContain("[ERROR]");
    });
});
