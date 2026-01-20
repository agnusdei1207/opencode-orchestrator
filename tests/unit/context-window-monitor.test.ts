/**
 * Context Window Monitor Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    calculateUsage,
    getAlertLevel,
    formatUsage,
    cleanupSession,
    CONTEXT_THRESHOLDS,
    CONTEXT_MONITOR_CONFIG,
} from "../../src/core/context/context-window-monitor";

describe("Context Window Monitor", () => {
    beforeEach(() => {
        cleanupSession("test-session");
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

    describe("getAlertLevel", () => {
        it("should return null for low usage", () => {
            expect(getAlertLevel(0.5)).toBeNull();
            expect(getAlertLevel(0.69)).toBeNull();
        });

        it("should return info for 70%+", () => {
            expect(getAlertLevel(0.70)).toBe("info");
            expect(getAlertLevel(0.75)).toBe("info");
            expect(getAlertLevel(0.84)).toBe("info");
        });

        it("should return warning for 85%+", () => {
            expect(getAlertLevel(0.85)).toBe("warning");
            expect(getAlertLevel(0.90)).toBe("warning");
            expect(getAlertLevel(0.94)).toBe("warning");
        });

        it("should return critical for 95%+", () => {
            expect(getAlertLevel(0.95)).toBe("critical");
            expect(getAlertLevel(0.99)).toBe("critical");
            expect(getAlertLevel(1.0)).toBe("critical");
        });
    });

    describe("formatUsage", () => {
        it("should format usage string correctly", () => {
            const result = formatUsage(0.75, 150000, 200000);
            expect(result).toBe("75% (150k/200k tokens)");
        });

        it("should round values", () => {
            const result = formatUsage(0.756, 151234, 200000);
            expect(result).toBe("76% (151k/200k tokens)");
        });
    });

    describe("CONTEXT_THRESHOLDS", () => {
        it("should have correct threshold values", () => {
            expect(CONTEXT_THRESHOLDS.INFO).toBe(0.70);
            expect(CONTEXT_THRESHOLDS.WARNING).toBe(0.85);
            expect(CONTEXT_THRESHOLDS.CRITICAL).toBe(0.95);
        });
    });

    describe("CONTEXT_MONITOR_CONFIG", () => {
        it("should have default max tokens", () => {
            expect(CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS).toBe(200000);
        });

        it("should have check interval", () => {
            expect(CONTEXT_MONITOR_CONFIG.CHECK_INTERVAL_MS).toBe(30000);
        });

        it("should have alert cooldown", () => {
            expect(CONTEXT_MONITOR_CONFIG.ALERT_COOLDOWN_MS).toBe(60000);
        });
    });
});
