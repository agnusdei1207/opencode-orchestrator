/**
 * ShutdownManager
 *
 * Coordinates graceful shutdown of all subsystems.
 * Ensures resources are properly cleaned up when the plugin is unloaded.
 */

import { LOG_PREFIX } from "../core/constants.js";
import type { CleanupRegistration } from "./registration.js";

export type CleanupFunction = () => void | Promise<void>;
type ShutdownLogger = (...args: unknown[]) => void;
const CLEANUP_TIMEOUT_MS = 5_000;

export class ShutdownManager {
    private cleanupHandlers: CleanupRegistration[] = [];
    private isShuttingDown = false;
    private shutdownPromise: Promise<void> | null = null;

    constructor(private readonly log: ShutdownLogger = () => { }) { }

    /**
     * Register a cleanup handler
     * @param name - Identifier for logging
     * @param fn - Cleanup function to execute
     * @param priority - Lower numbers run first (0-100). Default: 100
     */
    register(name: string, fn: CleanupFunction, priority: number = 100): void {
        if (this.isShuttingDown) {
            this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] Cannot register ${name} during shutdown`);
            return;
        }

        this.cleanupHandlers.push({ name, fn, priority });
        // Sort by priority (lower numbers first)
        this.cleanupHandlers.sort((a, b) => a.priority - b.priority);
        this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] Registered: ${name} (priority ${priority})`);
    }

    /**
     * Execute all cleanup handlers in priority order
     * Each handler gets 5 seconds max
     */
    async shutdown(): Promise<void> {
        // Prevent multiple simultaneous shutdowns
        if (this.isShuttingDown) {
            return this.shutdownPromise || Promise.resolve();
        }

        this.isShuttingDown = true;
        this.shutdownPromise = this._executeShutdown();
        return this.shutdownPromise;
    }

    private async _executeShutdown(): Promise<void> {
        this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] Starting shutdown sequence (${this.cleanupHandlers.length} handlers)`);

        for (const handler of this.cleanupHandlers) {
            try {
                this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] Cleaning up: ${handler.name}`);

                await runWithCleanupTimeout(handler.fn, CLEANUP_TIMEOUT_MS);

                this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] ✓ ${handler.name} completed`);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] ✗ ${handler.name} failed: ${errMsg}`);
                // Continue with other handlers even if one fails
            }
        }

        this.log(`[${LOG_PREFIX.SHUTDOWN_MANAGER}] Shutdown complete`);
    }

    /**
     * Check if shutdown is in progress
     */
    isShutdown(): boolean {
        return this.isShuttingDown;
    }
}

async function runWithCleanupTimeout(fn: CleanupFunction, timeoutMs: number): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    });

    try {
        await Promise.race([
            Promise.resolve(fn()),
            timeout,
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
