/**
 * ShutdownManager
 *
 * Coordinates graceful shutdown of all subsystems.
 * Ensures resources are properly cleaned up when the plugin is unloaded.
 */

import { log } from "../agents/logger.js";

export type CleanupFunction = () => void | Promise<void>;

interface CleanupHandler {
    name: string;
    fn: CleanupFunction;
    priority: number;
}

export class ShutdownManager {
    private cleanupHandlers: CleanupHandler[] = [];
    private isShuttingDown = false;
    private shutdownPromise: Promise<void> | null = null;

    /**
     * Register a cleanup handler
     * @param name - Identifier for logging
     * @param fn - Cleanup function to execute
     * @param priority - Lower numbers run first (0-100). Default: 100
     */
    register(name: string, fn: CleanupFunction, priority: number = 100): void {
        if (this.isShuttingDown) {
            log(`[ShutdownManager] Cannot register ${name} during shutdown`);
            return;
        }

        this.cleanupHandlers.push({ name, fn, priority });
        // Sort by priority (lower numbers first)
        this.cleanupHandlers.sort((a, b) => a.priority - b.priority);
        log(`[ShutdownManager] Registered: ${name} (priority ${priority})`);
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
        log(`[ShutdownManager] Starting shutdown sequence (${this.cleanupHandlers.length} handlers)`);

        for (const handler of this.cleanupHandlers) {
            try {
                log(`[ShutdownManager] Cleaning up: ${handler.name}`);

                // Race between cleanup and 5s timeout
                await Promise.race([
                    Promise.resolve(handler.fn()),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout`)), 5000)
                    )
                ]);

                log(`[ShutdownManager] ✓ ${handler.name} completed`);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                log(`[ShutdownManager] ✗ ${handler.name} failed: ${errMsg}`);
                // Continue with other handlers even if one fails
            }
        }

        log(`[ShutdownManager] Shutdown complete`);
    }

    /**
     * Check if shutdown is in progress
     */
    isShutdown(): boolean {
        return this.isShuttingDown;
    }
}
