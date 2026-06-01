import { EventEmitter } from "node:events";
import type { ChildProcess, spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RustToolPool } from "../../src/tools/rust-pool.js";

class FakeRustProcess extends EventEmitter {
    readonly stdout = new EventEmitter();
    readonly stderr = new EventEmitter();
    readonly stdin = {
        write: vi.fn((chunk: string) => {
            this.requests.push(chunk);
            this.onWrite?.(chunk);
            return true;
        }),
    };
    readonly kill = vi.fn(() => true);
    readonly requests: string[] = [];
    onWrite?: (chunk: string) => void;
}

function createPool(
    processes: FakeRustProcess[],
    requestTimeoutMs = 5,
    processReadyDelayMs = 0
): RustToolPool {
    return new RustToolPool(1, {
        binaryPath: () => "/fake/orchestrator",
        exists: () => true,
        processReadyDelayMs,
        requestTimeoutMs,
        spawnProcess: vi.fn(() => {
            const process = processes.shift();
            if (!process) {
                throw new Error("unexpected spawn");
            }
            return process as unknown as ChildProcess;
        }) as unknown as typeof spawn,
    });
}

describe("RustToolPool timeout recovery", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("kills and removes a process whose request times out", async () => {
        const process = new FakeRustProcess();
        const pool = createPool([process]);

        await expect(pool.call("lsp_diagnostics", { file: "src/index.ts" }))
            .rejects.toThrow("Request timeout");

        expect(process.kill).toHaveBeenCalledTimes(1);
        expect(process.stdout.listenerCount("data")).toBe(0);
        expect(pool.getStats()).toEqual({ total: 0, busy: 0, idle: 0 });

        await pool.shutdown();
    });

    it("uses a fresh process for later requests after a timeout", async () => {
        const timedOutProcess = new FakeRustProcess();
        const freshProcess = new FakeRustProcess();
        freshProcess.onWrite = (request) => {
            const { id } = JSON.parse(request) as { id: number };
            freshProcess.stdout.emit("data", Buffer.from(JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: "fresh response" }] },
            }) + "\n"));
        };
        const pool = createPool([timedOutProcess, freshProcess]);

        await expect(pool.call("lsp_diagnostics", { file: "src/index.ts" }))
            .rejects.toThrow("Request timeout");
        const result = await pool.call("git_status", {});

        expect(result).toBe("fresh response");
        expect(timedOutProcess.kill).toHaveBeenCalledTimes(1);
        expect(timedOutProcess.stdin.write).toHaveBeenCalledTimes(1);
        expect(freshProcess.stdin.write).toHaveBeenCalledTimes(1);
        expect(freshProcess.kill).not.toHaveBeenCalled();
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });

    it("resolves a concurrent waiter with a fresh process after timeout removal", async () => {
        const timedOutProcess = new FakeRustProcess();
        const freshProcess = new FakeRustProcess();
        let markFirstRequestStarted: () => void = () => undefined;
        const firstRequestStarted = new Promise<void>((resolve) => {
            markFirstRequestStarted = resolve;
        });
        timedOutProcess.onWrite = () => {
            markFirstRequestStarted();
        };
        freshProcess.onWrite = (request) => {
            const { id } = JSON.parse(request) as { id: number };
            freshProcess.stdout.emit("data", Buffer.from(JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: "waiter response" }] },
            }) + "\n"));
        };
        const pool = createPool([timedOutProcess, freshProcess], 25);

        const timedOutCall = pool.call("lsp_diagnostics", { file: "src/index.ts" });
        await firstRequestStarted;
        const waitingCall = pool.call("git_status", {});

        await expect(timedOutCall).rejects.toThrow("Request timeout");
        await expect(waitingCall).resolves.toBe("waiter response");

        expect(timedOutProcess.kill).toHaveBeenCalledTimes(1);
        expect(timedOutProcess.stdin.write).toHaveBeenCalledTimes(1);
        expect(freshProcess.stdin.write).toHaveBeenCalledTimes(1);
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });

    it("keeps a successful process available for later requests", async () => {
        const process = new FakeRustProcess();
        process.onWrite = (request) => {
            const { id } = JSON.parse(request) as { id: number };
            process.stdout.emit("data", Buffer.from(JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: `response ${id}` }] },
            }) + "\n"));
        };
        const pool = createPool([process]);

        await expect(pool.call("git_status", {})).resolves.toBe("response 1");
        await expect(pool.call("git_status", {})).resolves.toBe("response 2");

        expect(process.kill).not.toHaveBeenCalled();
        expect(process.stdin.write).toHaveBeenCalledTimes(2);
        expect(process.stdout.listenerCount("data")).toBe(0);
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });

    it("reserves a newly spawned process until the creator sends and releases it", async () => {
        vi.useFakeTimers();

        const process = new FakeRustProcess();
        const writtenToolNames: string[] = [];
        process.onWrite = (request) => {
            const payload = JSON.parse(request) as {
                id: number;
                params: { name: string };
            };
            writtenToolNames.push(payload.params.name);
            process.stdout.emit("data", Buffer.from(JSON.stringify({
                jsonrpc: "2.0",
                id: payload.id,
                result: { content: [{ type: "text", text: `${payload.params.name} response` }] },
            }) + "\n"));
        };
        const pool = createPool([process], 1_000, 50);

        const firstCall = pool.call("first_tool", {});
        const secondCall = pool.call("second_tool", {});

        await vi.advanceTimersByTimeAsync(49);

        expect(process.stdin.write).not.toHaveBeenCalled();
        expect(pool.getStats()).toEqual({ total: 1, busy: 1, idle: 0 });

        await vi.advanceTimersByTimeAsync(1);
        await expect(firstCall).resolves.toBe("first_tool response");

        await vi.advanceTimersByTimeAsync(10);
        await expect(secondCall).resolves.toBe("second_tool response");

        expect(writtenToolNames).toEqual(["first_tool", "second_tool"]);
        expect(process.kill).not.toHaveBeenCalled();
        expect(process.stdin.write).toHaveBeenCalledTimes(2);
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });
});
