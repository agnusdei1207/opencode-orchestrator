import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMissionLoop, readLoopState, cancelMissionLoop } from "../../src/core/loop/mission-loop";
import { handleMissionIdle, handleAbort, cleanupSession } from "../../src/core/loop/mission-loop-handler";
import { resetSessionActivity } from "../../src/core/session/activity";
import { configureMissionRuntimeOptions } from "../../src/core/loop/mission-runtime-options";
import { readMissionLedger } from "../../src/core/loop/mission-ledger";
import type { PluginInput } from "@opencode-ai/plugin";

const tasks = vi.hoisted(() => ({ read: vi.fn((): Array<{ status: string }> => []) }));
vi.mock("node:fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:fs")>();
    return { ...actual, unlinkSync: vi.fn(actual.unlinkSync) };
});
vi.mock("../../src/core/agents/manager", () => ({ ParallelAgentManager: { getInstance: () => ({ getTasksByParent: tasks.read }) } }));
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/notification/os-notify/notifier", () => ({ sendNotification: vi.fn() }));
vi.mock("../../src/core/notification/os-notify/sound-player", () => ({ playSound: vi.fn() }));

describe("mission idle ownership", () => {
    let directory: string;
    const sessionID = "mission-owner";
    let prompt: ReturnType<typeof vi.fn>;
    let status: ReturnType<typeof vi.fn>;
    let client: PluginInput["client"];

    beforeEach(() => {
        vi.useFakeTimers();
        cleanupSession(sessionID);
        resetSessionActivity();
        tasks.read.mockReset().mockReturnValue([]);
        configureMissionRuntimeOptions({ ledger: false, markdownMemory: false });
        directory = mkdtempSync(join(tmpdir(), "mission-owner-"));
        startMissionLoop(directory, sessionID, "Finish the requested scope");
        prompt = vi.fn().mockResolvedValue({ data: {} });
        status = vi.fn().mockResolvedValue({ data: {} });
        client = { session: { prompt, status } } as unknown as PluginInput["client"];
    });
    afterEach(() => {
        cleanupSession(sessionID);
        resetSessionActivity();
        configureMissionRuntimeOptions({});
        vi.useRealTimers();
        rmSync(directory, { recursive: true, force: true });
    });

    it.each(["pending", "running"])("does not complete while delegated work is %s", async (taskStatus) => {
        tasks.read.mockReturnValue([{ status: taskStatus }]);
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Parent checked item");
        await handleMissionIdle(client, directory, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("rejects another root without replacing the active project mission", () => {
        const original = readLoopState(directory);
        expect(() => startMissionLoop(directory, "other-root", "Unrelated request")).toThrow(/active mission.*mission-owner/i);
        expect(readLoopState(directory)).toEqual(original);
    });

    it("does not infer task completion when the task manager is unavailable", async () => {
        tasks.read.mockImplementation(() => { throw new Error("unavailable"); });
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Parent checked item");
        await handleMissionIdle(client, directory, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
    });

    it("does not complete after abort even when verification passes", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        handleAbort(sessionID);
        await handleMissionIdle(client, directory, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
    });

    it("does not inject a captured mission after cancellation during countdown", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle(client, directory, sessionID);
        cancelMissionLoop(directory, sessionID);
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
        expect(readLoopState(directory)).toBeNull();
    });

    it("does not clear a replacement mission from an old countdown", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle(client, directory, sessionID);
        cancelMissionLoop(directory, sessionID);
        startMissionLoop(directory, "new-owner", "New objective");
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        await vi.advanceTimersByTimeAsync(3000);
        expect(readLoopState(directory)?.sessionID).toBe("new-owner");
        expect(prompt).not.toHaveBeenCalled();
    });

    it("rechecks abort after awaiting the final host status", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle(client, directory, sessionID);
        status.mockImplementation(async () => { handleAbort(sessionID); return { data: {} }; });
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("keeps mission state when the host cannot establish idle for completion", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        status.mockRejectedValue(new Error("status unavailable"));
        await handleMissionIdle(client, directory, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
    });

    it("does not schedule a continuation after shutdown during an awaited toast", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        const { shutdownMissionLoopHandler } = await import("../../src/core/loop/mission-loop-handler");
        const toastClient = { ...client, tui: { showToast: async () => { shutdownMissionLoopHandler(); return {}; } } } as unknown as PluginInput["client"];
        await handleMissionIdle(toastClient, directory, sessionID);
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("does not record completion when clearing persisted mission state fails", async () => {
        configureMissionRuntimeOptions({ ledger: true, markdownMemory: false });
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        vi.mocked(unlinkSync).mockImplementationOnce(() => { throw new Error("disk denied"); });
        await handleMissionIdle(client, directory, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
        expect(readMissionLedger(directory).some(event => event.type === "mission_completed")).toBe(false);
    });
});
