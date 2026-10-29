import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMissionLoop, readLoopState, cancelMissionLoop } from "../../src/core/loop/mission-loop";
import { handleMissionIdle, handleAbort, cleanupSession } from "../../src/core/loop/mission-loop-handler";
import { resetSessionActivity } from "../../src/core/session/activity";
import { configureMissionRuntimeOptions } from "../../src/core/loop/mission-runtime-options";
import { readMissionLedger } from "../../src/core/loop/mission-ledger";
import { getCircuitState, recordAssistantTurn } from "../../src/core/loop/circuit-breaker";
import type { HostClient } from "../../src/host/client";

const tasks = vi.hoisted(() => ({ read: vi.fn((): Array<{ status: string }> => []) }));
const taskSource = { getTasksByParent: () => tasks.read() } as never;
vi.mock("node:fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:fs")>();
    return { ...actual, unlinkSync: vi.fn(actual.unlinkSync) };
});
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/notification/os-notify/notifier", () => ({ sendNotification: vi.fn() }));
vi.mock("../../src/core/notification/os-notify/sound-player", () => ({ playSound: vi.fn() }));

describe("mission idle ownership", () => {
    let directory: string;
    const sessionID = "mission-owner";
    let prompt: ReturnType<typeof vi.fn>;
    let statuses: ReturnType<typeof vi.fn>;
    let client: HostClient;

    beforeEach(() => {
        vi.useFakeTimers();
        cleanupSession(sessionID);
        resetSessionActivity();
        tasks.read.mockReset().mockReturnValue([]);
        configureMissionRuntimeOptions({ ledger: false, markdownMemory: false });
        directory = mkdtempSync(join(tmpdir(), "mission-owner-"));
        startMissionLoop(directory, sessionID, "Finish the requested scope");
        prompt = vi.fn().mockResolvedValue(undefined);
        statuses = vi.fn(() => new Map<string, string>());
        client = { prompt, statuses } as unknown as HostClient;
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
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("rejects another root without replacing the active project mission", () => {
        const original = readLoopState(directory);
        expect(() => startMissionLoop(directory, "other-root", "Unrelated request")).toThrow(/active mission.*mission-owner/i);
        expect(readLoopState(directory)).toEqual(original);
    });

    it("rejects replacement when the expected mission has changed", () => {
        const expected = readLoopState(directory)!;
        cancelMissionLoop(directory, sessionID);
        startMissionLoop(directory, "third-owner", "Newer mission");
        expect(() => startMissionLoop(directory, "other-root", "Stale request", {
            replaceExisting: expected,
        })).toThrow(/active mission.*third-owner/i);
        expect(readLoopState(directory)).toMatchObject({ sessionID: "third-owner", objective: "Newer mission" });
    });

    it("does not infer task completion when the task manager is unavailable", async () => {
        tasks.read.mockImplementation(() => { throw new Error("unavailable"); });
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Parent checked item");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
    });

    it("does not complete after abort even when verification passes", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        handleAbort(sessionID);
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
    });

    it("does not inject a captured mission after cancellation during countdown", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        cancelMissionLoop(directory, sessionID);
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
        expect(readLoopState(directory)).toBeNull();
    });

    it("does not clear a replacement mission from an old countdown", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        cancelMissionLoop(directory, sessionID);
        startMissionLoop(directory, "new-owner", "New objective");
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        await vi.advanceTimersByTimeAsync(3000);
        expect(readLoopState(directory)?.sessionID).toBe("new-owner");
        expect(prompt).not.toHaveBeenCalled();
    });

    it("does not inject an old countdown after an authorized replacement", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        const expected = readLoopState(directory)!;
        startMissionLoop(directory, "new-owner", "Replacement objective", { replaceExisting: expected });
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
        expect(readLoopState(directory)).toMatchObject({ sessionID: "new-owner", objective: "Replacement objective" });
    });

    it("rechecks abort after awaiting the final host status", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        statuses.mockImplementation(() => { handleAbort(sessionID); return new Map(); });
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("keeps mission state while the host reports the session busy", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        statuses.mockReturnValue(new Map([[sessionID, "busy"]]));
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("drops a pending continuation when the host reports busy before injection", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        statuses.mockReturnValue(new Map([[sessionID, "busy"]]));
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).not.toHaveBeenCalled();
    });

    it("injects the continuation as one synthetic prompt", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        await vi.advanceTimersByTimeAsync(3000);
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(prompt).toHaveBeenCalledWith({
            sessionID,
            text: expect.stringContaining('<mission_loop iteration="2">'),
            synthetic: true,
        });
    });

    it("does not record completion when clearing persisted mission state fails", async () => {
        configureMissionRuntimeOptions({ ledger: true, markdownMemory: false });
        writeFileSync(join(directory, ".opencode/todo.md"), "- [x] Done");
        vi.mocked(unlinkSync).mockImplementationOnce(() => { throw new Error("disk denied"); });
        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        expect(readLoopState(directory)?.active).toBe(true);
        expect(readMissionLedger(directory).some(event => event.type === "mission_completed")).toBe(false);
    });

    it("continues after repeated tool calls because tool use is progress", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        for (let index = 0; index < 3; index += 1) recordAssistantTurn(sessionID, "Reading files", 1);

        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        await vi.advanceTimersByTimeAsync(3000);

        expect(prompt).toHaveBeenCalledTimes(1);
        expect(getCircuitState(sessionID)?.isOpen).toBe(false);
    });

    it("does not record an injection the host rejected", async () => {
        configureMissionRuntimeOptions({ ledger: true, markdownMemory: false });
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        prompt.mockRejectedValue(new Error("rejected"));

        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        await vi.advanceTimersByTimeAsync(3000);

        expect(prompt).toHaveBeenCalledTimes(1);
        expect(readMissionLedger(directory).map(event => event.type)).not.toContain("prompt_injected");
    });

    it("opens the circuit for repeated text-only assistant turns", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        for (let index = 0; index < 3; index += 1) {
            recordAssistantTurn(sessionID, "I cannot make progress", 0);
        }

        await handleMissionIdle({ client, directory, tasks: taskSource }, sessionID);
        await vi.advanceTimersByTimeAsync(3000);

        expect(prompt).not.toHaveBeenCalled();
        expect(getCircuitState(sessionID)?.isOpen).toBe(true);
    });
});
