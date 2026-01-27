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
    lastUsed: number;
    requestId: number;
    pendingResolve?: (value: string) => void;
    pendingReject?: (error: Error) => void;
    stdout: string;
}

export class RustToolPool {
    private processes: PooledProcess[] = [];
    private maxSize = 4;
    private idleTimeout = 30_000; // 30 seconds
    private cleanupInterval: NodeJS.Timeout | null = null;
    private shuttingDown = false;

    constructor(maxSize: number = 4) {
        this.maxSize = maxSize;
        this.startCleanupTimer();
    }

    /**
     * Call a Rust tool using pooled connection
     */
    async call(name: string, args: Record<string, unknown>): Promise<string> {
        if (this.shuttingDown) {
            throw new Error("Pool is shutting down");
        }

        const binary = getBinaryPath();
        if (!existsSync(binary)) {
            return JSON.stringify({ error: `Binary not found: ${binary}` });
        }

        // Try to get an available process
        let pooled = this.getAvailable();

        // If none available and under limit, create new one
        if (!pooled && this.processes.length < this.maxSize) {
            pooled = await this.createProcess(binary);
        }

        // If still none, wait for one to become available
        if (!pooled) {
            pooled = await this.waitForAvailable();
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
     * Wait for a process to become available
     */
    private async waitForAvailable(): Promise<PooledProcess> {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const available = this.getAvailable();
                if (available) {
                    clearInterval(interval);
                    resolve(available);
                }
            }, 10);
        });
    }

    /**
     * Create a new pooled process
     */
    private async createProcess(binary: string): Promise<PooledProcess> {
        return new Promise((resolve, reject) => {
            const proc = spawn(binary, ["serve"], {
                stdio: ["pipe", "pipe", "pipe"],
                detached: false
            });

            let started = false;
            const pooled: PooledProcess = {
                proc,
                busy: false,
                lastUsed: Date.now(),
                requestId: 0,
                stdout: ""
            };

            // Setup stderr logging
            proc.stderr?.on("data", (data) => {
                const msg = data.toString().trim();
                if (msg && msg.includes("Listening")) {
                    started = true;
                }
            });

            // Handle process death
            proc.on("close", () => {
                const index = this.processes.indexOf(pooled);
                if (index !== -1) {
                    this.processes.splice(index, 1);
                }
            });

            proc.on("error", (err) => {
                const index = this.processes.indexOf(pooled);
                if (index !== -1) {
                    this.processes.splice(index, 1);
                }
                if (!started) {
                    reject(err);
                }
            });

            this.processes.push(pooled);

            // Wait a bit for the process to be ready
            setTimeout(() => resolve(pooled), 100);
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

        return new Promise((resolve, reject) => {
            const requestId = ++pooled.requestId;
            const timeout = setTimeout(() => {
                pooled.pendingResolve = undefined;
                pooled.pendingReject = undefined;
                reject(new Error("Request timeout"));
            }, 60_000);

            // Setup response handler
            const onData = (data: Buffer) => {
                pooled.stdout += data.toString();

                // Try to parse complete JSON response
                const lines = pooled.stdout.trim().split("\n");
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const response = JSON.parse(lines[i]);
                        if (response.id === requestId && (response.result || response.error)) {
                            clearTimeout(timeout);
                            pooled.proc.stdout?.removeListener("data", onData);

                            const text = response?.result?.content?.[0]?.text;
                            resolve(text || JSON.stringify(response.result));
                            return;
                        }
                    } catch {
                        continue;
                    }
                }
            };

            pooled.proc.stdout?.on("data", onData);

            // Send request
            const request = JSON.stringify({
                jsonrpc: "2.0",
                id: requestId,
                method: "tools/call",
                params: { name, arguments: args },
            });

            try {
                pooled.proc.stdin?.write(request + "\n");
            } catch (err) {
                clearTimeout(timeout);
                pooled.proc.stdout?.removeListener("data", onData);
                reject(err);
            }
        });
    }

    /**
     * Release a process back to the pool
     */
    private release(pooled: PooledProcess): void {
        pooled.busy = false;
        pooled.lastUsed = Date.now();
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
                try {
                    pooled.proc.kill();
                } catch {
                    // Ignore
                }
                const index = this.processes.indexOf(pooled);
                if (index !== -1) {
                    this.processes.splice(index, 1);
                }
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

        for (const pooled of this.processes) {
            try {
                pooled.proc.kill();
            } catch {
                // Ignore
            }
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
 * Shutdown the global pool
 */
export async function shutdownRustToolPool(): Promise<void> {
    if (globalPool) {
        await globalPool.shutdown();
        globalPool = null;
    }
}
