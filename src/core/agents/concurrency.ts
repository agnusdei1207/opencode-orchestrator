/**
 * Concurrency Controller
 * 
 * Queue-based rate limiting with support for:
 * - Agent-specific limits
 * - Provider-specific limits (e.g., anthropic/*, openai/*)
 * - Model-specific limits (e.g., anthropic/claude-3-5-sonnet)
 */

import { PARALLEL_TASK } from "../../shared/constants.js";

const DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";
const log = (...args: unknown[]) => {
    if (DEBUG) console.log("[concurrency]", ...args);
};

export interface ConcurrencyConfig {
    defaultConcurrency?: number;
    agentConcurrency?: Record<string, number>;
    providerConcurrency?: Record<string, number>;
    modelConcurrency?: Record<string, number>;
}

export class ConcurrencyController {
    private counts: Map<string, number> = new Map();
    private queues: Map<string, Array<() => void>> = new Map();
    private limits: Map<string, number> = new Map();
    private config: ConcurrencyConfig;

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
