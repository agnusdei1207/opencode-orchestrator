/**
 * Rust Tool Connection Pool
 *
 * Reuses persistent Rust processes for tool calls.
 */

import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { getBinaryPath } from "../utils/binary.js";
import { log } from "../core/agents/logger.js";
import { LOG_PREFIX } from "../shared/index.js";

interface PooledProcess {
    proc: ChildProcess;
    busy: boolean;
    destroyed: boolean;
    lastUsed: number;
    requestId: number;
    pendingReject?: (error: Error) => void;
    pendingCleanup?: () => void;
    stdout: string;
    stopping?: Promise<boolean>;
}

interface RustToolPoolOptions {
    binaryPath?: () => string;
    exists?: (path: string) => boolean;
    idleTimeoutMs?: number;
    processReadyDelayMs?: number;
    requestTimeoutMs?: number;
    spawnProcess?: typeof spawn;
}

interface JsonRpcToolCallRequest {
    jsonrpc: "2.0";
    id: number;
    method: "tools/call";
    params: {
        name: string;
        arguments: Record<string, unknown>;
    };
}

function hasOwnProperty(value: object, property: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, property);
}

function buildToolCallRequest(
    requestId: number,
    name: string,
    args: Record<string, unknown>,
): JsonRpcToolCallRequest {
    return {
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: { name, arguments: args },
    };
}

function serializeToolCallRequest(request: JsonRpcToolCallRequest): string {
    return JSON.stringify(request);
}

function stringifyJsonRpcPayload(value: unknown): string {
    return JSON.stringify(value) ?? String(value);
}

function validatePoolSize(maxSize: number): number {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
        throw new Error(`RustToolPool maxSize must be a positive integer, got ${maxSize}`);
    }
    return maxSize;
}

function parseJsonLine(line: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch (error) {
        log(`[${LOG_PREFIX.RUST_POOL}] Ignoring malformed JSON-RPC line`, { line, error });
        return null;
    }
}

function responseBelongsToRequest(response: Record<string, unknown>, requestId: number): boolean {
    return response.id === requestId &&
        (hasOwnProperty(response, "result") || hasOwnProperty(response, "error"));
}

function extractResponseText(response: Record<string, unknown>): string {
    const result = response.result as { content?: Array<{ text?: unknown }> } | undefined;
    const text = result?.content?.[0]?.text;
    if (text !== undefined) {
        return String(text);
    }
    if (hasOwnProperty(response, "result")) {
        return stringifyJsonRpcPayload(response.result);
    }
    return stringifyJsonRpcPayload(response.error);
}

type FailRequest = (error: Error, kill: boolean) => void;

interface StartupGate {
    /** Runs `callback` only for the first outcome and disarms the ready timer. */
    settle(callback: () => void): void;
    arm(readyTimer: NodeJS.Timeout): void;
}

function createStartupGate(): StartupGate {
    let startupSettled = false;
    let readyTimer: NodeJS.Timeout | null = null;
    return {
        settle(callback: () => void): void {
            if (startupSettled) {
                return;
            }

            startupSettled = true;
            if (readyTimer) {
                clearTimeout(readyTimer);
                readyTimer = null;
            }
            callback();
        },
        arm(timer: NodeJS.Timeout): void {
            readyTimer = timer;
        },
    };
}

/** Buffers stdout and settles on the first complete line answering `requestId`. */
function createResponseReader(
    pooled: PooledProcess,
    requestId: number,
    succeed: (text: string) => void,
): (data: Buffer) => void {
    return (data: Buffer) => {
        pooled.stdout += data.toString();

        let newlineIndex = pooled.stdout.indexOf("\n");
        while (newlineIndex !== -1) {
            const line = pooled.stdout.slice(0, newlineIndex).trim();
            pooled.stdout = pooled.stdout.slice(newlineIndex + 1);
            newlineIndex = pooled.stdout.indexOf("\n");
            if (!line) {
                continue;
            }

            const response = parseJsonLine(line);
            if (response && responseBelongsToRequest(response, requestId)) {
                succeed(extractResponseText(response));
                return;
            }
        }
    };
}

function writeRequest(pooled: PooledProcess, request: string, fail: FailRequest): void {
    try {
        if (!pooled.proc.stdin) {
            fail(new Error("Failed to write request to Rust tool process"), true);
        } else {
            // false means accepted with backpressure, not a failed send.
            pooled.proc.stdin.write(request + "\n");
        }
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        fail(error, true);
    }
}

export class RustToolPool {
    private processes: PooledProcess[] = [];
    private retiring = new Set<PooledProcess>();
    private maxSize = 4;
    private idleTimeout = 30_000; // 30 seconds
    private processReadyDelay = 100;
    private requestTimeout = 60_000;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly binaryPath: () => string;
    private readonly exists: (path: string) => boolean;
    private readonly spawnProcess: typeof spawn;
    private shuttingDown = false;

    constructor(maxSize: number = 4, options: RustToolPoolOptions = {}) {
        this.maxSize = validatePoolSize(maxSize);
        this.binaryPath = options.binaryPath ?? getBinaryPath;
        this.exists = options.exists ?? existsSync;
        this.idleTimeout = options.idleTimeoutMs ?? this.idleTimeout;
        this.processReadyDelay = options.processReadyDelayMs ?? this.processReadyDelay;
        this.requestTimeout = options.requestTimeoutMs ?? this.requestTimeout;
        this.spawnProcess = options.spawnProcess ?? spawn;
        this.startCleanupTimer();
    }

    /**
     * Call a Rust tool using pooled connection
     */
    async call(name: string, args: Record<string, unknown>): Promise<string> {
        if (this.shuttingDown) {
            throw new Error("Pool is shutting down");
        }

        const binary = this.binaryPath();
        if (!this.exists(binary)) {
            return JSON.stringify({ error: `Binary not found: ${binary}` });
        }

        let pooled = this.getAvailable();
        if (!pooled) {
            pooled = await this.createOrWaitForProcess(binary);
        }

        // Use the process
        try {
            return await this.sendRequest(pooled, name, args);
        } finally {
            this.release(pooled);
        }
    }

    /**
     * Get an available process from pool
     */
    private getAvailable(): PooledProcess | null {
        return this.processes.find(p => !p.busy) || null;
    }

    /**
     * Create a process immediately, or wait until one is available/capacity opens.
     */
    private async createOrWaitForProcess(binary: string): Promise<PooledProcess> {
        if (this.processes.length < this.maxSize) {
            return this.createProcess(binary);
        }

        return this.waitForAvailable(binary);
    }

    /**
     * Wait for a process to become available, or create one if capacity opens.
     */
    private async waitForAvailable(binary: string): Promise<PooledProcess> {
        return new Promise((resolve, reject) => {
            const waitTimeoutMs = this.requestTimeout + this.processReadyDelay + 1_000;
            let settled = false;
            let interval: NodeJS.Timeout | undefined;
            let timeout: NodeJS.Timeout | undefined;
            const settle = (callback: () => void): void => {
                if (settled) {
                    return;
                }
                settled = true;
                if (interval) clearInterval(interval);
                if (timeout) clearTimeout(timeout);
                callback();
            };
            interval = setInterval(() => {
                if (this.shuttingDown) {
                    settle(() => reject(new Error("Pool is shutting down")));
                    return;
                }

                const available = this.getAvailable();
                if (available) {
                    settle(() => resolve(available));
                    return;
                }

                if (this.processes.length < this.maxSize) {
                    settle(() => {
                        this.createProcess(binary).then(resolve, reject);
                    });
                }
            }, 10);
            timeout = setTimeout(() => {
                settle(() => reject(new Error(`Timed out waiting for available Rust tool process after ${waitTimeoutMs}ms`)));
            }, waitTimeoutMs);

            interval.unref?.();
            timeout.unref?.();
        });
    }

    /**
     * Create a new pooled process
     */
    private async createProcess(binary: string): Promise<PooledProcess> {
        return new Promise((resolve, reject) => {
            const pooled = this.spawnPooledProcess(binary);
            const startup = createStartupGate();

            this.watchProcess(pooled, error => startup.settle(() => reject(error)));

            this.processes.push(pooled);

            // Wait a bit for the process to be ready
            startup.arm(setTimeout(() => {
                startup.settle(() => resolve(pooled));
            }, this.processReadyDelay));
        });
    }

    private spawnPooledProcess(binary: string): PooledProcess {
        const proc = this.spawnProcess(binary, ["serve"], {
            stdio: ["pipe", "pipe", "pipe"],
            detached: false
        });
        // Server diagnostics must never block JSON-RPC output on a full pipe.
        proc.stderr?.resume();

        return {
            proc,
            busy: true,
            destroyed: false,
            lastUsed: Date.now(),
            requestId: 0,
            stdout: ""
        };
    }

    /**
     * Route process death and pipe errors to the startup promise, the in-flight
     * request, and pool membership.
     */
    private watchProcess(pooled: PooledProcess, failStartup: (error: Error) => void): void {
        const { proc } = pooled;

        // Handle process death
        proc.on("close", () => {
            this.retiring.delete(pooled);
            const error = new Error("Rust tool process closed before completing request");
            failStartup(error);
            pooled.pendingReject?.(error);
            this.removeProcess(pooled, false);
        });

        proc.on("error", (err) => {
            const error = err instanceof Error ? err : new Error(String(err));
            failStartup(error);
            pooled.pendingReject?.(error);
            // Errors include failed signals; a spawned child still needs close.
            if (!this.retiring.has(pooled)) this.removeProcess(pooled, proc.pid !== undefined);
        });

        proc.stdin?.on("error", (error: Error) => {
            failStartup(error);
            pooled.pendingReject?.(error);
            this.removeProcess(pooled, true);
        });
    }

    /**
     * Send a request to a pooled process
     */
    private async sendRequest(
        pooled: PooledProcess,
        name: string,
        args: Record<string, unknown>
    ): Promise<string> {
        pooled.busy = true;
        pooled.lastUsed = Date.now();
        pooled.stdout = "";

        if (pooled.destroyed || !this.processes.includes(pooled)) {
            throw new Error("Rust tool process is unavailable");
        }

        return new Promise((resolve, reject) => {
            const requestId = ++pooled.requestId;
            const fail = this.trackRequest(pooled, requestId, resolve, reject);

            // Send request
            const request = serializeToolCallRequest(buildToolCallRequest(requestId, name, args));
            writeRequest(pooled, request, fail);
        });
    }

    /**
     * Arm the timeout and response reader for one request. Returns the failure
     * path, which also evicts the process.
     */
    private trackRequest(
        pooled: PooledProcess,
        requestId: number,
        resolve: (text: string) => void,
        reject: (error: Error) => void,
    ): FailRequest {
        let settled = false;
        const settleOnce = (): boolean => {
            if (settled) return false;
            settled = true;
            cleanup();
            return true;
        };
        const fail: FailRequest = (error, kill) => {
            if (!settleOnce()) return;
            this.removeProcess(pooled, kill);
            reject(error);
        };
        const succeed = (text: string): void => {
            if (settleOnce()) resolve(text);
        };
        const timeout = setTimeout(() => {
            fail(new Error("Request timeout"), true);
        }, this.requestTimeout);
        const onData = createResponseReader(pooled, requestId, succeed);
        const cleanup = (): void => {
            clearTimeout(timeout);
            pooled.pendingReject = undefined;
            pooled.pendingCleanup = undefined;
            pooled.proc.stdout?.removeListener("data", onData);
        };

        pooled.pendingReject = (error: Error) => fail(error, false);
        pooled.pendingCleanup = cleanup;
        pooled.proc.stdout?.on("data", onData);
        return fail;
    }

    /**
     * Release a process back to the pool
     */
    private release(pooled: PooledProcess): void {
        if (pooled.destroyed || !this.processes.includes(pooled)) {
            return;
        }

        pooled.busy = false;
        pooled.lastUsed = Date.now();
    }

    /**
     * Remove a process from the pool, optionally terminating it first.
     */
    private removeProcess(pooled: PooledProcess, kill: boolean): void {
        pooled.destroyed = true;
        pooled.pendingCleanup?.();

        if (kill) {
            this.retiring.add(pooled);
            this.stopProcess(pooled);
        }

        const index = this.processes.indexOf(pooled);
        if (index !== -1) {
            this.processes.splice(index, 1);
        }
    }

    private stopProcess(pooled: PooledProcess): Promise<boolean> {
        if (pooled.stopping) return pooled.stopping;
        pooled.stopping = new Promise<boolean>(resolve => {
            const finish = (closed: boolean): void => {
                clearTimeout(timer);
                pooled.proc.removeListener("close", onClose);
                resolve(closed);
            };
            const onClose = (): void => finish(true);
            const timer = setTimeout(() => finish(false), 2_000);
            pooled.proc.once("close", onClose);
            try {
                if (!pooled.proc.kill("SIGKILL")) finish(false);
            } catch (error) {
                log(`[${LOG_PREFIX.RUST_POOL}] Failed to kill process`, error);
                finish(false);
            }
        }).finally(() => { pooled.stopping = undefined; });
        return pooled.stopping;
    }

    /**
     * Start cleanup timer for idle processes
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const toRemove: PooledProcess[] = [];

            for (const pooled of this.processes) {
                if (!pooled.busy && now - pooled.lastUsed > this.idleTimeout) {
                    toRemove.push(pooled);
                }
            }

            for (const pooled of toRemove) {
                this.removeProcess(pooled, true);
            }

            if (toRemove.length > 0) {
                log(`[${LOG_PREFIX.RUST_POOL}] Cleaned up ${toRemove.length} idle processes`);
            }
        }, 10_000);

        this.cleanupInterval.unref?.();
    }

    /**
     * Shutdown pool
     */
    async shutdown(): Promise<void> {
        this.shuttingDown = true;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        const owned = new Set([...this.processes, ...this.retiring]);
        const stopped: Promise<boolean>[] = [];
        for (const pooled of owned) {
            pooled.pendingReject?.(new Error("Pool is shutting down"));
            this.removeProcess(pooled, true);
            stopped.push(pooled.stopping!);
        }

        if ((await Promise.all(stopped)).some(closed => !closed)) {
            throw new Error("Could not terminate Rust tool processes");
        }
        log(`[${LOG_PREFIX.RUST_POOL}] Shutdown complete`);
    }

    /**
     * Get pool statistics
     */
    getStats(): { total: number; busy: number; idle: number } {
        const busy = this.processes.filter(p => p.busy).length;
        return {
            total: this.processes.length,
            busy,
            idle: this.processes.length - busy
        };
    }
}

// Global pool instance
let globalPool: RustToolPool | null = null;
let resetInFlight: Promise<void> | null = null;

/**
 * Get or create the global pool
 */
export function getRustToolPool(): RustToolPool {
    if (!globalPool) {
        globalPool = new RustToolPool();
    }
    return globalPool;
}

/**
 * Reset the global pool, optionally only if it still matches the expected pool.
 *
 * The expected-pool guard prevents an older failing caller from shutting down a
 * newer singleton that was created while the older pool was being reset.
 */
export async function resetRustToolPool(
    reason = "manual reset",
    expectedPool?: RustToolPool
): Promise<void> {
    while (resetInFlight) {
        await resetInFlight;
    }

    const poolToReset = globalPool;
    if (!poolToReset) {
        return;
    }

    if (expectedPool && poolToReset !== expectedPool) {
        log(`[${LOG_PREFIX.RUST_POOL}] Skipped reset for stale pool: ${reason}`);
        return;
    }

    resetInFlight = (async () => {
        log(`[${LOG_PREFIX.RUST_POOL}] Resetting global pool: ${reason}`);
        await poolToReset.shutdown();
        globalPool = null;
    })();

    try {
        await resetInFlight;
    } finally {
        resetInFlight = null;
    }
}

/**
 * Shutdown the global pool
 */
export async function shutdownRustToolPool(): Promise<void> {
    await resetRustToolPool("shutdown");
}
