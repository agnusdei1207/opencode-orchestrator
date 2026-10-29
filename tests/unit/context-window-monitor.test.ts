/**
 * Context Window Monitor Unit Tests
 *
 * The monitor only records the latest host-reported usage per session; the
 * resource-control hook decides what to do with it.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    calculateUsage,
    cleanupSession,
    checkContextWindow,
    getContextUsage,
    CONTEXT_THRESHOLDS,
    CONTEXT_MONITOR_CONFIG,
} from "../../src/core/context/context-window-monitor";

beforeEach(() => {
    cleanupSession("test-session");
    cleanupSession("session-2");
});

describe("calculateUsage", () => {
    it("should calculate usage percentage", () => {
        expect(calculateUsage(50000, 100000)).toBe(0.5);
        expect(calculateUsage(70000, 100000)).toBe(0.7);
        expect(calculateUsage(100000, 100000)).toBe(1.0);
    });

    it("should handle edge cases", () => {
        expect(calculateUsage(0, 100000)).toBe(0);
        expect(calculateUsage(0, 0)).toBe(0); // No division by zero
    });
});

describe("checkContextWindow and usage tracking", () => {
    it("records the latest usage per session", () => {
        checkContextWindow("test-session", 150000, 200000);
        expect(getContextUsage("test-session")).toEqual({ usedTokens: 150000, maxTokens: 200000 });

        checkContextWindow("test-session", 155000, 1_000_000);
        expect(getContextUsage("test-session")).toEqual({ usedTokens: 155000, maxTokens: 1_000_000 });
    });

    it("defaults the window to the configured maximum", () => {
        checkContextWindow("test-session", 1000);
        expect(getContextUsage("test-session")).toEqual({
            usedTokens: 1000,
            maxTokens: CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS,
        });
    });

    it("isolates sessions and forgets a session on cleanup", () => {
        checkContextWindow("test-session", 1000, 2000);
        checkContextWindow("session-2", 3000, 4000);

        cleanupSession("test-session");

        expect(getContextUsage("test-session")).toBeUndefined();
        expect(getContextUsage("session-2")).toEqual({ usedTokens: 3000, maxTokens: 4000 });
    });
});

describe("CONTEXT_THRESHOLDS", () => {
    it("should have the compaction warning threshold", () => {
        expect(CONTEXT_THRESHOLDS.WARNING).toBe(0.85);
    });
});

describe("CONTEXT_MONITOR_CONFIG", () => {
    it("should have default max tokens", () => {
        expect(CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS).toBe(200000);
    });
});
