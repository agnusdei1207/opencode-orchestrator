/**
 * Concurrency Controller
 * 
 * Queue-based rate limiting with support for:
 * - Agent-specific limits
 * - Provider-specific limits (e.g., anthropic/*, openai/*)
 * - Model-specific limits (e.g., anthropic/claude-3-5-sonnet)
 */

import { PARALLEL_TASK } from "../../shared/index.js";
import type { ConcurrencyConfig } from "./interfaces/concurrency-config.interface.js";

// Re-export interface
export type { ConcurrencyConfig } from "./interfaces/concurrency-config.interface.js";

import { log as internalLog } from "../agents/logger.js";

const DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";
const log = (...args: unknown[]) => {
    if (DEBUG) internalLog("[concurrency]", ...args);
};

export class ConcurrencyController {
    private counts: Map<string, number> = new Map();
    private queues: Map<string, Array<() => void>> = new Map();
    private limits: Map<string, number> = new Map();
    private config: ConcurrencyConfig;
    private successStreak: Map<string, number> = new Map();
    private failureCount: Map<string, number> = new Map();

    constructor(config?: ConcurrencyConfig) {
        this.config = config ?? {};
    }

    setLimit(key: string, limit: number): void {
        this.limits.set(key, limit);
    }

    /**
     * Get concurrency limit for a key.
     * Priority: explicit limit > model > provider > agent > default
     */
    getConcurrencyLimit(key: string): number {
        // Check explicit limit first
        const explicitLimit = this.limits.get(key);
        if (explicitLimit !== undefined) {
            return explicitLimit === 0 ? Infinity : explicitLimit;
        }

        // Check model-specific (e.g., "anthropic/claude-3-5-sonnet")
        if (this.config.modelConcurrency?.[key] !== undefined) {
            const limit = this.config.modelConcurrency[key];
            return limit === 0 ? Infinity : limit;
        }

        // Check provider-specific (e.g., "anthropic")
        const provider = key.split("/")[0];
        if (this.config.providerConcurrency?.[provider] !== undefined) {
            const limit = this.config.providerConcurrency[provider];
            return limit === 0 ? Infinity : limit;
        }

        // Check agent-specific
        if (this.config.agentConcurrency?.[key] !== undefined) {
            const limit = this.config.agentConcurrency[key];
            return limit === 0 ? Infinity : limit;
        }

        // Default
        return this.config.defaultConcurrency ?? PARALLEL_TASK.DEFAULT_CONCURRENCY;
    }

    // Backwards compatible alias
    getLimit(key: string): number {
        return this.getConcurrencyLimit(key);
    }

    async acquire(key: string): Promise<void> {
        const limit = this.getConcurrencyLimit(key);
        if (limit === Infinity) return;

        const current = this.counts.get(key) ?? 0;
        if (current < limit) {
            this.counts.set(key, current + 1);
            log(`Acquired ${key}: ${current + 1}/${limit}`);
            return;
        }

        log(`Queueing ${key}: ${current}/${limit}`);
        return new Promise<void>((resolve) => {
            const queue = this.queues.get(key) ?? [];
            queue.push(resolve);
            this.queues.set(key, queue);
        });
    }

    release(key: string): void {
        const limit = this.getConcurrencyLimit(key);
        if (limit === Infinity) return;

        const queue = this.queues.get(key);
        if (queue && queue.length > 0) {
            const next = queue.shift()!;
            log(`Released ${key}: next in queue`);
            next();
        } else {
            const current = this.counts.get(key) ?? 0;
            if (current > 0) {
                this.counts.set(key, current - 1);
                log(`Released ${key}: ${current - 1}/${limit}`);
            }
        }
    }

    /**
     * Report success/failure to adjust concurrency dynamically
     */
    reportResult(key: string, success: boolean): void {
        if (success) {
            // Success: increment streak
            const streak = (this.successStreak.get(key) ?? 0) + 1;
            this.successStreak.set(key, streak);
            this.failureCount.set(key, 0); // Reset failure on success

            // Increase limit if on a hot streak (every 5 successful tasks)
            if (streak % 5 === 0) {
                const currentLimit = this.getConcurrencyLimit(key);
                if (currentLimit < PARALLEL_TASK.MAX_CONCURRENCY) { // Use centralized constant
                    this.setLimit(key, currentLimit + 1);
                    internalLog(`[concurrency] Auto-scaling UP for ${key}: ${currentLimit + 1}`);
                }
            }
        } else {
            // Failure: increment failure count
            const failures = (this.failureCount.get(key) ?? 0) + 1;
            this.failureCount.set(key, failures);
            this.successStreak.set(key, 0); // Reset streak on failure

            // Decrease limit if failures detected
            if (failures >= 2) {
                const currentLimit = this.getConcurrencyLimit(key);
                const minLimit = 1;
                if (currentLimit > minLimit) {
                    this.setLimit(key, currentLimit - 1);
                    internalLog(`[concurrency] Auto-scaling DOWN for ${key}: ${currentLimit - 1} (due to ${failures} failures)`);
                }
            }
        }
    }

    getQueueLength(key: string): number {
        return this.queues.get(key)?.length ?? 0;
    }

    getActiveCount(key: string): number {
        return this.counts.get(key) ?? 0;
    }

    /**
     * Get formatted concurrency info string (e.g., "2/5 slots")
     */
    getConcurrencyInfo(key: string): string {
        const active = this.getActiveCount(key);
        const limit = this.getConcurrencyLimit(key);
        if (limit === Infinity) return "";
        return ` (${active}/${limit} slots)`;
    }
}
