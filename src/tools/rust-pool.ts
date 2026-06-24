/**
 * Rust Tool Connection Pool
 *
 * Maintains persistent Rust processes for faster tool calls.
 * First call: ~50-100ms (spawn overhead)
 * Subsequent calls: ~5-10ms (10x faster!)
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
    pendingResolve?: (value: string) => void;
    pendingReject?: (error: Error) => void;
    pendingCleanup?: () => void;
    stdout: string;
}

interface RustToolPoolOptions {
    binaryPath?: () => string;
    exists?: (path: string) => boolean;
    idleTimeoutMs?: number;
    processReadyDelayMs?: number;
    requestTimeoutMs?: number;
    spawnProcess?: typeof spawn;
}

function hasOwnProperty(value: object, property: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, property);
}

function stringifyJsonRpcPayload(value: unknown): string {
    return JSON.stringify(value) ?? String(value);
}

export class RustToolPool {
    private processes: PooledProcess[] = [];
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
        this.maxSize = maxSize;
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
            const interval = setInterval(() => {
                const available = this.getAvailable();
                if (available) {
                    clearInterval(interval);
                    resolve(available);
                    return;
                }

                if (this.processes.length < this.maxSize) {
                    clearInterval(interval);
                    this.createProcess(binary).then(resolve, reject);
                }
            }, 10);
        });
    }

    /**
     * Create a new pooled process
     */
    private async createProcess(binary: string): Promise<PooledProcess> {
        return new Promise((resolve, reject) => {
            const proc = this.spawnProcess(binary, ["serve"], {
                stdio: ["pipe", "pipe", "pipe"],
                detached: false
            });

            let startupSettled = false;
            let readyTimer: NodeJS.Timeout | null = null;
            const pooled: PooledProcess = {
                proc,
                busy: true,
                destroyed: false,
                lastUsed: Date.now(),
                requestId: 0,
                stdout: ""
            };

            const settleStartup = (callback: () => void): void => {
                if (startupSettled) {
                    return;
                }

                startupSettled = true;
                if (readyTimer) {
                    clearTimeout(readyTimer);
                    readyTimer = null;
                }
                callback();
            };

            // Handle process death
            proc.on("close", () => {
                const error = new Error("Rust tool process closed before completing request");
                settleStartup(() => reject(error));
                pooled.pendingReject?.(error);
                this.removeProcess(pooled, false);
            });

            proc.on("error", (err) => {
                const error = err instanceof Error ? err : new Error(String(err));
                settleStartup(() => reject(error));
                pooled.pendingReject?.(error);
                this.removeProcess(pooled, false);
            });

            this.processes.push(pooled);

            // Wait a bit for the process to be ready
            readyTimer = setTimeout(() => {
                settleStartup(() => resolve(pooled));
            }, this.processReadyDelay);
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
            let settled = false;
            const fail = (error: Error, kill: boolean) => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                this.removeProcess(pooled, kill);
                reject(error);
            };
            const succeed = (text: string) => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                resolve(text);
            };
            const timeout = setTimeout(() => {
                fail(new Error("Request timeout"), true);
            }, this.requestTimeout);
            const cleanup = () => {
                clearTimeout(timeout);
                pooled.pendingResolve = undefined;
                pooled.pendingReject = undefined;
                pooled.pendingCleanup = undefined;
                pooled.proc.stdout?.removeListener("data", onData);
            };

            // Setup response handler
            const onData = (data: Buffer) => {
                pooled.stdout += data.toString();

                // Try to parse complete JSON response
                const lines = pooled.stdout.trim().split("\n");
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const response = JSON.parse(lines[i]);
                        if (response.id === requestId && (hasOwnProperty(response, "result") || hasOwnProperty(response, "error"))) {
                            const text = response?.result?.content?.[0]?.text;
                            if (text !== undefined) {
                                succeed(String(text));
                                return;
                            }
                            if (hasOwnProperty(response, "result")) {
                                succeed(stringifyJsonRpcPayload(response.result));
                                return;
                            }
                            succeed(stringifyJsonRpcPayload(response.error));
                            return;
                        }
                    } catch {
                        continue;
                    }
                }
            };

            pooled.pendingReject = (error: Error) => fail(error, false);
            pooled.pendingCleanup = cleanup;
            pooled.proc.stdout?.on("data", onData);

            // Send request
            const request = JSON.stringify({
                jsonrpc: "2.0",
                id: requestId,
                method: "tools/call",
                params: { name, arguments: args },
            });

            try {
                const written = pooled.proc.stdin?.write(request + "\n");
                if (written === false || written === undefined) {
                    fail(new Error("Failed to write request to Rust tool process"), true);
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                fail(error, true);
            }
        });
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
            try {
                pooled.proc.kill();
            } catch {
                // Ignore
            }
        }

        const index = this.processes.indexOf(pooled);
        if (index !== -1) {
            this.processes.splice(index, 1);
        }
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

        this.cleanupInterval.unref();
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

        for (const pooled of [...this.processes]) {
            this.removeProcess(pooled, true);
        }

        this.processes = [];
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
        globalPool = null;
        log(`[${LOG_PREFIX.RUST_POOL}] Resetting global pool: ${reason}`);
        await poolToReset.shutdown();
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
