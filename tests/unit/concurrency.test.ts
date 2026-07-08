/**
 * Concurrency Controller Tests
 * 
 * Tests for:
 * - Basic acquire/release
 * - Queue behavior when at limit
 * - Model/Provider/Agent specific limits
 * - Infinite concurrency (limit = 0)
 * - getConcurrencyInfo helper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    CircuitState,
    ConcurrencyController,
    TaskPriority,
    type ConcurrencyConfig,
} from "../../src/core/agents/concurrency";

describe("ConcurrencyController", () => {
    let controller: ConcurrencyController;

    beforeEach(() => {
        controller = new ConcurrencyController();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ========================================================================
    // Basic Acquire/Release
    // ========================================================================

    describe("basic acquire/release", () => {
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
            controller.setLimit("agent-a", 1);

            await controller.acquire("agent-a");

            let resolved = false;
            const promise = controller.acquire("agent-a").then(() => {
                resolved = true;
            });

            // Should be queued
            expect(resolved).toBe(false);
            expect(controller.getQueueLength("agent-a")).toBe(1);

            // Release should trigger queued
            controller.release("agent-a");
            await promise;
            expect(resolved).toBe(true);
        });
    });

    // ========================================================================
    // Model/Provider/Agent Concurrency Limits
    // ========================================================================

    describe("hierarchical concurrency limits", () => {
        it("should use model-specific limit", () => {
            const config: ConcurrencyConfig = {
                modelConcurrency: { "anthropic/claude-3-5-sonnet": 2 },
                defaultConcurrency: 5,
            };
            controller = new ConcurrencyController(config);

            expect(controller.getConcurrencyLimit("anthropic/claude-3-5-sonnet")).toBe(2);
        });

        it("should use provider-specific limit when no model limit", () => {
            const config: ConcurrencyConfig = {
                providerConcurrency: { "anthropic": 3 },
                defaultConcurrency: 5,
            };
            controller = new ConcurrencyController(config);

            expect(controller.getConcurrencyLimit("anthropic/claude-3-opus")).toBe(3);
        });

        it("should use agent-specific limit", () => {
            const config: ConcurrencyConfig = {
                agentConcurrency: { "builder": 4 },
                defaultConcurrency: 5,
            };
            controller = new ConcurrencyController(config);

            expect(controller.getConcurrencyLimit("builder")).toBe(4);
        });

        it("should use default when no specific limit", () => {
            const config: ConcurrencyConfig = {
                defaultConcurrency: 7,
            };
            controller = new ConcurrencyController(config);

            expect(controller.getConcurrencyLimit("unknown")).toBe(7);
        });

        it("should return Infinity when limit is 0 (unlimited)", () => {
            const config: ConcurrencyConfig = {
                modelConcurrency: { "fast-model": 0 },
            };
            controller = new ConcurrencyController(config);

            expect(controller.getConcurrencyLimit("fast-model")).toBe(Infinity);
        });

        it("should return Infinity when explicit limit is 0", () => {
            controller.setLimit("agent-a", 0);

            expect(controller.getConcurrencyLimit("agent-a")).toBe(Infinity);
        });

        it("should reject invalid explicit limits", () => {
            expect(() => controller.setLimit("agent-a", -1)).toThrow("non-negative integer");
            expect(() => controller.setLimit("agent-a", 1.5)).toThrow("non-negative integer");
        });

        it("should reject invalid configured limits", () => {
            expect(() => new ConcurrencyController({ defaultConcurrency: -1 })).toThrow("non-negative integer");
            expect(() => new ConcurrencyController({ agentConcurrency: { worker: 2.5 } })).toThrow("non-negative integer");
        });
    });

    // ========================================================================
    // Infinite Concurrency
    // ========================================================================

    describe("infinite concurrency", () => {
        it("should not queue when limit is Infinity", async () => {
            const config: ConcurrencyConfig = {
                modelConcurrency: { "unlimited": 0 },
            };
            controller = new ConcurrencyController(config);

            // Should all resolve immediately
            await controller.acquire("unlimited");
            await controller.acquire("unlimited");
            await controller.acquire("unlimited");

            // Count should stay 0 (not tracked for infinite)
            expect(controller.getActiveCount("unlimited")).toBe(0);
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
        });

        it("should reject invalid acquisition timeout values", () => {
            expect(() => new ConcurrencyController({ acquisitionTimeoutMs: 0 })).toThrow("positive integer");
            expect(() => new ConcurrencyController({ acquisitionTimeoutMs: 1.5 })).toThrow("positive integer");
        });
    });

    describe("circuit breaker configuration", () => {
        it("should open the circuit at the configured failure threshold", () => {
            controller = new ConcurrencyController({ circuitFailureThreshold: 2 });

            controller.reportResult("agent-a", false);
            expect(controller.getCircuitState("agent-a")).toBe(CircuitState.CLOSED);

            controller.reportResult("agent-a", false);
            expect(controller.getCircuitState("agent-a")).toBe(CircuitState.OPEN);
        });

        it("should close half-open circuits after the configured success threshold", async () => {
            vi.useFakeTimers();
            controller = new ConcurrencyController({
                circuitFailureThreshold: 1,
                circuitRecoveryTimeoutMs: 10,
                halfOpenSuccessThreshold: 1,
            });

            controller.reportResult("agent-a", false);
            await vi.advanceTimersByTimeAsync(11);
            await controller.acquire("agent-a");

            expect(controller.getCircuitState("agent-a")).toBe(CircuitState.HALF_OPEN);

            controller.reportResult("agent-a", true);

            expect(controller.getCircuitState("agent-a")).toBe(CircuitState.CLOSED);
        });

        it("should reject invalid circuit and resource pressure config", () => {
            expect(() => new ConcurrencyController({ circuitFailureThreshold: 0 })).toThrow("positive integer");
            expect(() => new ConcurrencyController({ circuitRecoveryTimeoutMs: 0 })).toThrow("positive integer");
            expect(() => new ConcurrencyController({ halfOpenSuccessThreshold: 0 })).toThrow("positive integer");
            expect(() => new ConcurrencyController({ resourcePressureMaxHeapPercent: 101 })).toThrow("percentage");
        });
    });

    describe("resource pressure", () => {
        it("should expose pressure metrics and include them in low-priority rejection", async () => {
            const memorySpy = vi.spyOn(process, "memoryUsage").mockReturnValue({
                rss: 100,
                heapTotal: 100,
                heapUsed: 91,
                external: 0,
                arrayBuffers: 0,
            });
            controller = new ConcurrencyController({ resourcePressureMaxHeapPercent: 90 });

            const pressure = controller.getResourcePressureStatus();

            expect(pressure).toMatchObject({
                underPressure: true,
                heapUsed: 91,
                heapTotal: 100,
                heapPercent: 91,
                maxHeapPercent: 90,
            });
            await expect(controller.acquire("agent-low", TaskPriority.LOW))
                .rejects.toThrow("91.0% heap used");
            await expect(controller.acquire("agent-normal", TaskPriority.NORMAL))
                .resolves.toBeUndefined();

            memorySpy.mockRestore();
        });
    });

    describe("token shutdown ownership", () => {
        it("should release active tokens during controller shutdown", async () => {
            controller = new ConcurrencyController({ defaultConcurrency: 1 });

            const token = await controller.acquireToken("agent-a", TaskPriority.NORMAL, 60_000);

            expect(controller.getActiveCount("agent-a")).toBe(1);

            await controller.shutdown();

            expect(token.isReleased()).toBe(true);
            expect(controller.getActiveCount("agent-a")).toBe(0);
        });
    });

    // ========================================================================
    // Concurrency Info Helper
    // ========================================================================

    // ========================================================================
    // Auto-scaling (reportResult)
    // ========================================================================

    describe("auto-scaling", () => {
        it("should increase limit after 3 consecutive successes", () => {
            controller.setLimit("agent-a", 2);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);

            // 2 successes - no change yet
            for (let i = 0; i < 2; i++) {
                controller.reportResult("agent-a", true);
            }
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);

            // 3rd success - should increase to 3
            controller.reportResult("agent-a", true);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(3);
        });

        it("should decrease limit after 2 failures", () => {
            controller.setLimit("agent-a", 5);

            // 1 failure - no change yet
            controller.reportResult("agent-a", false);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(5);

            // 2nd failure - should decrease to 4
            controller.reportResult("agent-a", false);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(4);
        });

        it("should not decrease below 1", () => {
            controller.setLimit("agent-a", 1);

            controller.reportResult("agent-a", false);
            controller.reportResult("agent-a", false);

            expect(controller.getConcurrencyLimit("agent-a")).toBe(1);
        });

        it("should reset success streak on failure", () => {
            controller.setLimit("agent-a", 2);

            // 2 successes - no change
            controller.reportResult("agent-a", true);
            controller.reportResult("agent-a", true);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);

            // 1 failure
            controller.reportResult("agent-a", false);

            // 1 more success (should be 1st after reset)
            controller.reportResult("agent-a", true);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);
        });
    });
});
