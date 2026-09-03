/**
 * Context Window Monitor Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    calculateUsage,
    getAlertLevel,
    formatUsage,
    cleanupSession,
    checkContextWindow,
    getContextInjection,
    getContextUsage,
    getMonitorStatus,
    CONTEXT_THRESHOLDS,
    CONTEXT_MONITOR_CONFIG,
} from "../../src/core/context/context-window-monitor";
import * as Toast from "../../src/core/notification/toast";

vi.mock("../../src/core/notification/toast", () => ({
    show: vi.fn(),
}));

describe("Context Window Monitor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    describe("getContextInjection", () => {
        it("returns null for low usage", () => {
            expect(getContextInjection(50000, 200000)).toBeNull();
        });

        it("returns info, warning, and critical prompt injections", () => {
            const info = getContextInjection(150000, 200000); // 75%
            expect(info).toContain("plenty of headroom");

            const warn = getContextInjection(180000, 200000); // 90%
            expect(warn).toContain("Context is getting full");

            const crit = getContextInjection(195000, 200000); // 97.5%
            expect(crit).toContain("CRITICAL: Context near limit");
        });
    });

    describe("checkContextWindow and status tracking", () => {
        it("shows alert and tracks usage and status", () => {
            checkContextWindow("test-session", 150000, 200000);
            expect(Toast.show).toHaveBeenCalledTimes(1);

            const usage = getContextUsage("test-session");
            expect(usage).toEqual({ usedTokens: 150000, maxTokens: 200000 });

            const status = getMonitorStatus("test-session");
            expect(status?.lastAlertLevel).toBe("info");

            // Cooldown prevents duplicate alerts of same level
            checkContextWindow("test-session", 155000, 200000);
            expect(Toast.show).toHaveBeenCalledTimes(1);

            // Escalating to critical alerts despite cooldown
            checkContextWindow("test-session", 195000, 200000);
            expect(Toast.show).toHaveBeenCalledTimes(2);

            cleanupSession("test-session");
            expect(getMonitorStatus("test-session")).toBeNull();
        });

        it("ignores low usage without triggering toast", () => {
            checkContextWindow("test-session", 50000, 200000);
            expect(Toast.show).not.toHaveBeenCalled();
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
