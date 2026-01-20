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

import { describe, it, expect, beforeEach } from "vitest";
import { ConcurrencyController, type ConcurrencyConfig } from "../../src/core/agents/concurrency";

describe("ConcurrencyController", () => {
    let controller: ConcurrencyController;

    beforeEach(() => {
        controller = new ConcurrencyController();
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

    // ========================================================================
    // Concurrency Info Helper
    // ========================================================================

    // ========================================================================
    // Auto-scaling (reportResult)
    // ========================================================================

    describe("auto-scaling", () => {
        it("should increase limit after 5 consecutive successes", () => {
            controller.setLimit("agent-a", 2);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);

            // 4 successes - no change yet
            for (let i = 0; i < 4; i++) {
                controller.reportResult("agent-a", true);
            }
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);

            // 5th success - should increase to 3
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

            // 4 successes
            for (let i = 0; i < 4; i++) {
                controller.reportResult("agent-a", true);
            }

            // 1 failure
            controller.reportResult("agent-a", false);

            // 1 more success (should be 1st after reset)
            controller.reportResult("agent-a", true);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);
        });
    });
});
