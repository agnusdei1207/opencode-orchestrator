/**
 * Concurrency Controller
 * 
 * Queue-based rate limiting per agent type.
 */

import { PARALLEL_TASK } from "../../shared/constants.js";

const DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";
const log = (...args: unknown[]) => {
    if (DEBUG) console.log("[concurrency]", ...args);
};

export class ConcurrencyController {
    private counts: Map<string, number> = new Map();
    private queues: Map<string, Array<() => void>> = new Map();
    private limits: Map<string, number> = new Map();

    setLimit(key: string, limit: number): void {
        this.limits.set(key, limit);
    }

    getLimit(key: string): number {
        return this.limits.get(key) ?? PARALLEL_TASK.DEFAULT_CONCURRENCY;
    }

    async acquire(key: string): Promise<void> {
        const limit = this.getLimit(key);
        if (limit === 0) return;

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
        const limit = this.getLimit(key);
        if (limit === 0) return;

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
}
