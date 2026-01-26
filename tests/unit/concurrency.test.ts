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
    // Auto-scaling (DISABLED - reportResult for metrics only)
    // ========================================================================

    describe("auto-scaling (DISABLED)", () => {
        it("should NOT change limit after successes (auto-scaling disabled)", () => {
            controller.setLimit("agent-a", 2);
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2);

            // Report 5 successes - should NOT change limit
            for (let i = 0; i < 5; i++) {
                controller.reportResult("agent-a", true);
            }
            expect(controller.getConcurrencyLimit("agent-a")).toBe(2); // Unchanged
        });

        it("should NOT change limit after failures (auto-scaling disabled)", () => {
            controller.setLimit("agent-a", 5);

            // Report 2 failures - should NOT change limit
            controller.reportResult("agent-a", false);
            controller.reportResult("agent-a", false);

            expect(controller.getConcurrencyLimit("agent-a")).toBe(5); // Unchanged
        });

        it("should still track metrics without changing limits", () => {
            controller.setLimit("agent-a", 3);

            // Report success/failure - just for metrics
            controller.reportResult("agent-a", true);
            controller.reportResult("agent-a", false);

            // Limit should remain unchanged
            expect(controller.getConcurrencyLimit("agent-a")).toBe(3);
        });
    });
});
