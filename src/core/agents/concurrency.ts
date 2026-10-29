/**
 * Concurrency Controller - caps concurrent delegated tasks per agent and
 * queues the rest in arrival order.
 */

import { PARALLEL_TASK } from "../../shared/index.js";
import type { ConcurrencyConfig } from "../config/options.js";

const DEFAULT_ACQUISITION_TIMEOUT_MS = 300_000;

interface Waiter {
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

export class ConcurrencyController {
    private closed = false;
    private readonly counts = new Map<string, number>();
    private readonly queues = new Map<string, Waiter[]>();

    constructor(private readonly config: ConcurrencyConfig = {}) { }

    /** Slots for this agent; Infinity when the configured limit is 0. */
    getConcurrencyLimit(key: string): number {
        const limit = this.config.agentConcurrency?.[key]
            ?? this.config.defaultConcurrency
            ?? PARALLEL_TASK.DEFAULT_CONCURRENCY;
        return limit === 0 ? Infinity : limit;
    }

    async acquire(key: string): Promise<void> {
        if (this.closed) throw new Error("Concurrency controller shut down");
        const limit = this.getConcurrencyLimit(key);
        if (limit === Infinity) return;
        const active = this.counts.get(key) ?? 0;
        if (active < limit) {
            this.counts.set(key, active + 1);
            return;
        }
        return new Promise<void>((resolve, reject) => {
            const timeoutMs = this.config.acquisitionTimeoutMs ?? DEFAULT_ACQUISITION_TIMEOUT_MS;
            const waiter: Waiter = {
                resolve,
                reject,
                timeoutId: setTimeout(() => {
                    this.removeWaiter(key, waiter);
                    reject(new Error(`Concurrency acquisition timed out after ${timeoutMs}ms for ${key}`));
                }, timeoutMs),
            };
            const queue = this.queues.get(key) ?? [];
            queue.push(waiter);
            this.queues.set(key, queue);
        });
    }

    /** Hand the slot to the next waiter, or free it. */
    release(key: string): void {
        if (this.getConcurrencyLimit(key) === Infinity) return;
        const next = this.queues.get(key)?.shift();
        if (next) {
            clearTimeout(next.timeoutId);
            next.resolve();
            return;
        }
        const active = this.counts.get(key) ?? 0;
        if (active > 0) this.counts.set(key, active - 1);
    }

    getActiveCount(key: string): number {
        return this.counts.get(key) ?? 0;
    }

    getQueueLength(key: string): number {
        return this.queues.get(key)?.length ?? 0;
    }

    async shutdown(): Promise<void> {
        this.closed = true;
        for (const queue of this.queues.values()) {
            for (const waiter of queue) {
                clearTimeout(waiter.timeoutId);
                waiter.reject(new Error("Concurrency controller shut down"));
            }
        }
        this.queues.clear();
        this.counts.clear();
    }

    private removeWaiter(key: string, waiter: Waiter): void {
        const queue = this.queues.get(key);
        const index = queue?.indexOf(waiter) ?? -1;
        if (queue && index !== -1) queue.splice(index, 1);
        if (queue?.length === 0) this.queues.delete(key);
    }
}
