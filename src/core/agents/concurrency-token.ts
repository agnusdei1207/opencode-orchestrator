/**
 * ConcurrencyToken
 *
 * RAII-style token for concurrency slot management.
 * Automatically releases slot if not manually released within timeout.
 */

import type { ConcurrencyController } from "./concurrency.js";

export class ConcurrencyToken {
    private released = false;
    private autoReleaseTimer: NodeJS.Timeout | null = null;

    constructor(
        private controller: ConcurrencyController,
        private key: string,
        private autoReleaseMs: number = 600_000 // 10 minutes default
    ) {
        // Auto-release after timeout as safety net
        this.autoReleaseTimer = setTimeout(() => {
            if (!this.released) {
                this.release();
            }
        }, autoReleaseMs);

        // Don't prevent process exit
        this.autoReleaseTimer.unref();
    }

    /**
     * Manually release the concurrency slot
     */
    release(): void {
        if (this.released) return;

        this.released = true;

        // Clear auto-release timer
        if (this.autoReleaseTimer) {
            clearTimeout(this.autoReleaseTimer);
            this.autoReleaseTimer = null;
        }

        // Release the slot
        this.controller.release(this.key);
    }

    /**
     * Check if token has been released
     */
    isReleased(): boolean {
        return this.released;
    }
}
