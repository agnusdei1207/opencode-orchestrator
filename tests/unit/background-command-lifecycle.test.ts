import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { backgroundTaskManager } from "../../src/core/commands/manager";
import { runBackgroundTool } from "../../src/tools/background-cmd/run";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
class FakeProcess extends EventEmitter {
    stdout = new PassThrough();
    stderr = new PassThrough();
    kill = vi.fn(() => true);
}
let child: FakeProcess;
beforeEach(() => {
    child = new FakeProcess();
    vi.mocked(spawn).mockReturnValue(child as never);
});
afterEach(async () => {
    child.emit("close", 0);
    await backgroundTaskManager.shutdown();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("Background shell transport", () => {
    it("retains ownership after a process error until close confirms exit", () => {
        const task = backgroundTaskManager.run({ command: "fixture" });
        child.emit("error", new Error("signal failed"));
        expect(task.process).toBe(child);
        expect(task.status).toBe("running");
        expect(task.errorOutput).toContain("signal failed");
        child.emit("close", 1);
        expect(task.status).toBe("error");
    });
    it("keeps a running task controllable when the kill signal is rejected", async () => {
        const task = backgroundTaskManager.run({ command: "fixture" });
        child.kill.mockReturnValue(false);
        expect(await backgroundTaskManager.kill(task.id)).toBe(false);
        expect(task.status).toBe("running");
        expect(task.process).toBe(child);
        child.stdout.emit("data", Buffer.from("still running"));
        expect(task.output).toBe("still running");
    });

    it("waits for process close before claiming successful termination", async () => {
        const task = backgroundTaskManager.run({ command: "fixture" });
        const stopping = backgroundTaskManager.kill(task.id);
        expect(task.status).toBe("running");
        expect(task.process).toBe(child);
        child.emit("close", null);
        expect(await stopping).toBe(true);
        expect(task.status).toBe("error");
        expect(task.process).toBeUndefined();
    });

    it("retains process observation when timeout termination is rejected", async () => {
        vi.useFakeTimers();
        const task = backgroundTaskManager.run({ command: "fixture", timeout: 10 });
        child.kill.mockReturnValue(false);
        await vi.advanceTimersByTimeAsync(10);
        expect(task.status).toBe("running");
        expect(task.process).toBe(child);
        expect(task.errorOutput).toContain("termination failed");
    });

    it("reports failed shutdown and retains the task for a later termination attempt", async () => {
        const task = backgroundTaskManager.run({ command: "fixture" });
        child.kill.mockReturnValue(false);
        await expect(backgroundTaskManager.shutdown()).rejects.toThrow("Could not terminate background tasks");
        expect(backgroundTaskManager.get(task.id)?.process).toBe(child);
        child.kill.mockReturnValue(true);
    });

    it.each([undefined, "subfolder"])("resolves cwd %s against the host session directory", async cwd => {
        const directory = resolve("session-project");
        await runBackgroundTool.execute({ command: "fixture", cwd }, { directory } as never);
        const task = backgroundTaskManager.getAll()[0];
        expect(task.cwd).toBe(resolve(directory, cwd || "."));
    });
});
