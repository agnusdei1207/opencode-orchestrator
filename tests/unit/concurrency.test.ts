/**
 * Concurrency Controller Tests
 *
 * Tests for:
 * - Basic acquire/release
 * - FIFO queue behavior when at limit
 * - Agent-specific and default limits
 * - Infinite concurrency (limit = 0)
 * - Acquisition timeout
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import type { ConcurrencyConfig } from "../../src/core/config/options";
import { PARALLEL_TASK } from "../../src/shared";

describe("ConcurrencyController", () => {
    let controller: ConcurrencyController;

    beforeEach(() => {
        controller = new ConcurrencyController();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("basic acquire/release", () => {
        it("rejects queued admissions on shutdown without starting them", async () => {
            controller = new ConcurrencyController({ agentConcurrency: { "agent-a": 1 } });
            await controller.acquire("agent-a");
            const queued = controller.acquire("agent-a");
            const rejected = expect(queued).rejects.toThrow("shut down");
            await controller.shutdown();
            controller.release("agent-a");
            await rejected;
            expect(controller.getQueueLength("agent-a")).toBe(0);
            await expect(controller.acquire("agent-a")).rejects.toThrow("shut down");
        });

        it("should acquire when under limit", async () => {
            await controller.acquire("agent-a");
            expect(controller.getActiveCount("agent-a")).toBe(1);
        });

        it("should release and decrement count", async () => {
            await controller.acquire("agent-a");
            controller.release("agent-a");
            expect(controller.getActiveCount("agent-a")).toBe(0);
        });

        it("should queue when at limit", async () => {
            controller = new ConcurrencyController({ agentConcurrency: { "agent-a": 1 } });

            await controller.acquire("agent-a");

            let resolved = false;
            const promise = controller.acquire("agent-a").then(() => {
                resolved = true;
            });

            await Promise.resolve();
            expect(resolved).toBe(false);
            expect(controller.getQueueLength("agent-a")).toBe(1);

            // Release hands the slot to the queued waiter
            controller.release("agent-a");
            await promise;
            expect(resolved).toBe(true);
            expect(controller.getActiveCount("agent-a")).toBe(1);
            expect(controller.getQueueLength("agent-a")).toBe(0);
        });

        it("admits queued waiters in arrival order", async () => {
            controller = new ConcurrencyController({ defaultConcurrency: 1 });
            await controller.acquire("agent-a");

            const order: number[] = [];
            const first = controller.acquire("agent-a").then(() => order.push(1));
            const second = controller.acquire("agent-a").then(() => order.push(2));

            controller.release("agent-a");
            await first;
            controller.release("agent-a");
            await second;

            expect(order).toEqual([1, 2]);
        });

        it("keeps limits independent per key", async () => {
            controller = new ConcurrencyController({ defaultConcurrency: 1 });
            await controller.acquire("agent-a");
            await controller.acquire("agent-b");

            expect(controller.getActiveCount("agent-a")).toBe(1);
            expect(controller.getActiveCount("agent-b")).toBe(1);
            expect(controller.getQueueLength("agent-a")).toBe(0);
        });
    });

    describe("concurrency limits", () => {
        it("should use agent-specific limit", () => {
            const config: ConcurrencyConfig = {
                agentConcurrency: { "builder": 4 },
                defaultConcurrency: 5,
            };
            controller = new ConcurrencyController(config);

            expect(controller.getConcurrencyLimit("builder")).toBe(4);
        });

        it("should use default when no specific limit", () => {
            controller = new ConcurrencyController({ defaultConcurrency: 7 });

            expect(controller.getConcurrencyLimit("unknown")).toBe(7);
        });

        it("falls back to the built-in default without config", () => {
            expect(controller.getConcurrencyLimit("unknown")).toBe(PARALLEL_TASK.DEFAULT_CONCURRENCY);
        });

        it("should return Infinity when an agent limit is 0 (unlimited)", () => {
            controller = new ConcurrencyController({ agentConcurrency: { "fast": 0 }, defaultConcurrency: 2 });

            expect(controller.getConcurrencyLimit("fast")).toBe(Infinity);
            expect(controller.getConcurrencyLimit("other")).toBe(2);
        });

        it("should return Infinity when the default limit is 0", () => {
            controller = new ConcurrencyController({ defaultConcurrency: 0 });

            expect(controller.getConcurrencyLimit("agent-a")).toBe(Infinity);
        });
    });

    describe("infinite concurrency", () => {
        it("should not queue when limit is Infinity", async () => {
            controller = new ConcurrencyController({ agentConcurrency: { "unlimited": 0 } });

            await controller.acquire("unlimited");
            await controller.acquire("unlimited");
            await controller.acquire("unlimited");

            // Count stays 0 (not tracked for infinite)
            expect(controller.getActiveCount("unlimited")).toBe(0);
            expect(controller.getQueueLength("unlimited")).toBe(0);
        });
    });

    describe("acquisition timeout", () => {
        it("should use the configured acquisition timeout for queued tasks", async () => {
            vi.useFakeTimers();
            controller = new ConcurrencyController({ defaultConcurrency: 1, acquisitionTimeoutMs: 25 });

            await controller.acquire("agent-a");
            const queued = controller.acquire("agent-a");
            const queuedExpectation = expect(queued).rejects.toThrow("after 25ms");

            expect(controller.getQueueLength("agent-a")).toBe(1);

            await vi.advanceTimersByTimeAsync(25);

            await queuedExpectation;
            expect(controller.getQueueLength("agent-a")).toBe(0);
            // The timed-out waiter must not hold a slot
            expect(controller.getActiveCount("agent-a")).toBe(1);
        });
    });
});
