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

function emitTextResponse(process: FakeRustProcess, request: string, text: string): void {
    const { id } = JSON.parse(request) as { id: number };
    process.stdout.emit("data", Buffer.from(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text }] },
    }) + "\n"));
}

function emitErrorResponse(process: FakeRustProcess, request: string): void {
    const { id } = JSON.parse(request) as { id: number };
    process.stdout.emit("data", Buffer.from(JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: {
            code: -32603,
            message: "internal tool failure",
        },
    }) + "\n"));
}

function emitResultResponse(process: FakeRustProcess, request: string, result: unknown): void {
    const { id } = JSON.parse(request) as { id: number };
    process.stdout.emit("data", Buffer.from(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result,
    }) + "\n"));
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

    it("rejects invalid pool sizes before callers can wait forever", async () => {
        const pool = createPool([], 5);
        await pool.shutdown();

        expect(() => new RustToolPool(0)).toThrow("maxSize must be a positive integer");
        expect(() => new RustToolPool(-1)).toThrow("maxSize must be a positive integer");
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
            emitTextResponse(freshProcess, request, "fresh response");
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
            emitTextResponse(freshProcess, request, "waiter response");
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
            emitTextResponse(process, request, `response ${id}`);
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

    it("returns a JSON string for JSON-RPC error responses", async () => {
        const process = new FakeRustProcess();
        process.onWrite = (request) => {
            emitErrorResponse(process, request);
        };
        const pool = createPool([process]);

        await expect(pool.call("git_status", {})).resolves.toBe(JSON.stringify({
            code: -32603,
            message: "internal tool failure",
        }));
        expect(process.stdout.listenerCount("data")).toBe(0);
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });

    it("preserves empty text result content as an empty string", async () => {
        const process = new FakeRustProcess();
        process.onWrite = (request) => {
            emitTextResponse(process, request, "");
        };
        const pool = createPool([process]);

        await expect(pool.call("git_status", {})).resolves.toBe("");
        expect(process.stdout.listenerCount("data")).toBe(0);
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });

    it("resolves valid JSON-RPC responses with falsy result payloads", async () => {
        const process = new FakeRustProcess();
        process.onWrite = (request) => {
            const payload = JSON.parse(request) as {
                params: { name: string };
            };
            const resultByToolName: Record<string, unknown> = {
                null_result: null,
                false_result: false,
                zero_result: 0,
            };
            emitResultResponse(process, request, resultByToolName[payload.params.name]);
        };
        const pool = createPool([process]);

        await expect(pool.call("null_result", {})).resolves.toBe("null");
        await expect(pool.call("false_result", {})).resolves.toBe("false");
        await expect(pool.call("zero_result", {})).resolves.toBe("0");
        expect(process.stdout.listenerCount("data")).toBe(0);

        await pool.shutdown();
    });

    it("rejects promptly on child close, cleans listeners, removes the process, and recovers fresh", async () => {
        const closedProcess = new FakeRustProcess();
        const freshProcess = new FakeRustProcess();
        closedProcess.onWrite = () => {
            closedProcess.emit("close", 1, null);
        };
        freshProcess.onWrite = (request) => {
            emitTextResponse(freshProcess, request, "fresh after close");
        };
        const pool = createPool([closedProcess, freshProcess], 1_000);

        const started = Date.now();
        await expect(pool.call("lsp_diagnostics", { file: "src/index.ts" }))
            .rejects.toThrow("Rust tool process closed");
        const elapsed = Date.now() - started;
        const result = await pool.call("git_status", {});

        expect(elapsed).toBeLessThan(250);
        expect(result).toBe("fresh after close");
        expect(closedProcess.kill).not.toHaveBeenCalled();
        expect(closedProcess.stdout.listenerCount("data")).toBe(0);
        expect(freshProcess.stdin.write).toHaveBeenCalledTimes(1);
        expect(pool.getStats()).toEqual({ total: 1, busy: 0, idle: 1 });

        await pool.shutdown();
    });

    it("rejects promptly when a process closes before it becomes ready", async () => {
        const closedProcess = new FakeRustProcess();
        const pool = createPool([closedProcess], 1_000, 1_000);

        const started = Date.now();
        const call = pool.call("lsp_diagnostics", { file: "src/index.ts" });
        closedProcess.emit("close", 1, null);

        await expect(call).rejects.toThrow("Rust tool process closed");
        const elapsed = Date.now() - started;

        expect(elapsed).toBeLessThan(250);
        expect(closedProcess.kill).not.toHaveBeenCalled();
        expect(closedProcess.stdout.listenerCount("data")).toBe(0);
        expect(pool.getStats()).toEqual({ total: 0, busy: 0, idle: 0 });

        await pool.shutdown();
    });

    it("rejects promptly with the child error while an active request is pending", async () => {
        const failedProcess = new FakeRustProcess();
        const childError = new Error("child transport failed");
        failedProcess.onWrite = () => {
            failedProcess.emit("error", childError);
        };
        const pool = createPool([failedProcess], 1_000);

        const started = Date.now();
        await expect(pool.call("lsp_diagnostics", { file: "src/index.ts" }))
            .rejects.toThrow("child transport failed");
        const elapsed = Date.now() - started;

        expect(elapsed).toBeLessThan(250);
        expect(failedProcess.kill).not.toHaveBeenCalled();
        expect(failedProcess.stdout.listenerCount("data")).toBe(0);
        expect(pool.getStats()).toEqual({ total: 0, busy: 0, idle: 0 });

        await pool.shutdown();
    });

    it("rejects promptly on stdin write failure, kills the unsafe process, and recovers fresh", async () => {
        const writeThrowProcess = new FakeRustProcess();
        const writeFalseProcess = new FakeRustProcess();
        const freshProcess = new FakeRustProcess();
        writeThrowProcess.stdin.write.mockImplementation(() => {
            throw new Error("stdin is closed");
        });
        writeFalseProcess.stdin.write.mockReturnValue(false);
        freshProcess.onWrite = (request) => {
            emitTextResponse(freshProcess, request, "fresh after write failure");
        };
        const pool = createPool([writeThrowProcess, writeFalseProcess, freshProcess], 1_000);

        const throwStarted = Date.now();
        await expect(pool.call("lsp_diagnostics", { file: "src/index.ts" }))
            .rejects.toThrow("stdin is closed");
        const throwElapsed = Date.now() - throwStarted;
        const falseStarted = Date.now();
        await expect(pool.call("lsp_diagnostics", { file: "src/index.ts" }))
            .rejects.toThrow("Failed to write request");
        const falseElapsed = Date.now() - falseStarted;
        const result = await pool.call("git_status", {});

        expect(throwElapsed).toBeLessThan(250);
        expect(falseElapsed).toBeLessThan(250);
        expect(result).toBe("fresh after write failure");
        expect(writeThrowProcess.kill).toHaveBeenCalledTimes(1);
        expect(writeFalseProcess.kill).toHaveBeenCalledTimes(1);
        expect(writeThrowProcess.stdout.listenerCount("data")).toBe(0);
        expect(writeFalseProcess.stdout.listenerCount("data")).toBe(0);
        expect(freshProcess.stdin.write).toHaveBeenCalledTimes(1);
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
