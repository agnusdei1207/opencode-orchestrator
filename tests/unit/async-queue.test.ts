/**
 * AsyncQueue & Work Pool Unit Tests
 */

import { afterEach, describe, it, expect, vi } from "vitest";
import {
    AsyncQueue,
    workPool,
    workPoolWithResults,
    processBatches,
    retryWithBackoff,
    withTimeout,
    debounceAsync
} from "../../src/core/queue/index";

describe("AsyncQueue", () => {
    describe("basic operations", () => {
        it("should push and pop items in order", async () => {
            const queue = new AsyncQueue<number>();

            queue.push(1);
            queue.push(2);
            queue.push(3);

            expect(await queue.next()).toBe(1);
            expect(await queue.next()).toBe(2);
            expect(await queue.next()).toBe(3);
        });

        it("should report correct length", () => {
            const queue = new AsyncQueue<string>();

            expect(queue.length).toBe(0);

            queue.push("a");
            queue.push("b");
            expect(queue.length).toBe(2);
        });

        it("should report isEmpty correctly", () => {
            const queue = new AsyncQueue<number>();

            expect(queue.isEmpty()).toBe(true);

            queue.push(1);
            expect(queue.isEmpty()).toBe(false);
        });

        it("should tryNext without blocking", () => {
            const queue = new AsyncQueue<number>();

            expect(queue.tryNext()).toBeUndefined();

            queue.push(42);
            expect(queue.tryNext()).toBe(42);
            expect(queue.tryNext()).toBeUndefined();
        });
    });

    describe("async iteration", () => {
        it("should support async iteration", async () => {
            const queue = new AsyncQueue<number>();
            const results: number[] = [];

            // Push items and close
            queue.push(1);
            queue.push(2);
            queue.push(3);
            queue.close();

            for await (const item of queue) {
                results.push(item);
                if (results.length >= 3) break;
            }

            expect(results).toEqual([1, 2, 3]);
        });
    });

    describe("close behavior", () => {
        it("should not allow pushing after close", () => {
            const queue = new AsyncQueue<number>();
            queue.close();

            expect(() => queue.push(1)).toThrow("Queue is closed");
        });

        it("should report isClosed correctly", () => {
            const queue = new AsyncQueue<number>();

            expect(queue.isClosed()).toBe(false);
            queue.close();
            expect(queue.isClosed()).toBe(true);
        });
    });
});

describe("workPool", () => {
    it("should process all items", async () => {
        const items = [1, 2, 3, 4, 5];
        const processed: number[] = [];

        await workPool(2, items, async (item) => {
            processed.push(item);
        });

        expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it("should respect concurrency limit", async () => {
        let concurrent = 0;
        let maxConcurrent = 0;

        const items = Array.from({ length: 10 }, (_, i) => i);

        await workPool(3, items, async () => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise(r => setTimeout(r, 10));
            concurrent--;
        });

        expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
});

describe("workPoolWithResults", () => {
    it("should return results in original order", async () => {
        const items = [3, 1, 4, 1, 5];

        const results = await workPoolWithResults(2, items, async (item) => {
            await new Promise(r => setTimeout(r, Math.random() * 10));
            return item * 2;
        });

        expect(results).toEqual([6, 2, 8, 2, 10]);
    });
});

describe("processBatches", () => {
    it("should process items in batches", async () => {
        const items = [1, 2, 3, 4, 5, 6, 7];
        const batches: number[][] = [];

        await processBatches(items, 3, async (batch) => {
            batches.push([...batch]);
            return batch.map(x => x * 2);
        });

        expect(batches).toEqual([
            [1, 2, 3],
            [4, 5, 6],
            [7],
        ]);
    });
});

describe("retryWithBackoff", () => {
    it("should succeed on first try if no error", async () => {
        const fn = vi.fn().mockResolvedValue("success");

        const result = await retryWithBackoff(fn, { maxRetries: 3 });

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure", async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error("fail 1"))
            .mockRejectedValueOnce(new Error("fail 2"))
            .mockResolvedValue("success");

        const result = await retryWithBackoff(fn, {
            maxRetries: 3,
            initialDelay: 10
        });

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("always fails"));

        await expect(
            retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10 })
        ).rejects.toThrow("always fails");

        expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
});

describe("withTimeout", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("should resolve if completes in time", async () => {
        const promise = new Promise<string>(r => setTimeout(() => r("done"), 10));

        const result = await withTimeout(promise, 1000);
        expect(result).toBe("done");
    });

    it("should reject on timeout", async () => {
        const promise = new Promise<string>(r => setTimeout(() => r("done"), 1000));

        await expect(
            withTimeout(promise, 50, "Custom timeout message")
        ).rejects.toThrow("Custom timeout message");
    });

    it("should clear its timeout when the wrapped promise settles first", async () => {
        vi.useFakeTimers();

        const result = await withTimeout(Promise.resolve("done"), 1000);

        expect(result).toBe("done");
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("debounceAsync", () => {
    it("should call the wrapped function only for the latest invocation", async () => {
        vi.useFakeTimers();
        try {
            const fn = vi.fn(async (value: string) => value.toUpperCase());
            const debounced = debounceAsync(fn, 100);

            const first = debounced("first");
            const second = debounced("second");

            await vi.advanceTimersByTimeAsync(100);

            await expect(first).resolves.toBe("SECOND");
            await expect(second).resolves.toBe("SECOND");
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith("second");
        } finally {
            vi.useRealTimers();
        }
    });

    it("should reject all pending callers when the latest invocation fails", async () => {
        vi.useFakeTimers();
        try {
            const error = new Error("failed");
            const fn = vi.fn(async () => {
                throw error;
            });
            const debounced = debounceAsync(fn, 100);

            const first = debounced("first");
            const second = debounced("second");
            const firstExpectation = expect(first).rejects.toThrow("failed");
            const secondExpectation = expect(second).rejects.toThrow("failed");

            await vi.advanceTimersByTimeAsync(100);

            await firstExpectation;
            await secondExpectation;
            expect(fn).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
