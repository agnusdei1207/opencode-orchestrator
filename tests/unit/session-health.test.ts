/**
 * Session Health Monitor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    recordSessionActivity,
    recordSessionResponse,
    isSessionStale,
    startHealthCheck,
    stopHealthCheck,
    cleanupSessionHealth,
    clearAllSessionHealth,
    getSessionHealth,
    getStaleSessions,
    performHealthCheck
} from "../../src/core/session/session-health.js";

// Mock log
vi.mock("../../src/core/agents/logger.js", () => ({
    log: vi.fn(),
}));

describe("SessionHealth", () => {
    const sessionID = "test-session-health";

    beforeEach(() => {
        clearAllSessionHealth();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2023, 1, 1, 0, 0, 0));
    });

    afterEach(() => {
        stopHealthCheck();
        vi.useRealTimers();
    });

    it("should track session activity", () => {
        const now = Date.now();
        recordSessionActivity(sessionID);

        const health = getSessionHealth(sessionID);
        expect(health).toBeDefined();
        // Allow small timing difference
        expect(health!.lastActiveTime).toBeGreaterThanOrEqual(now);
        expect(health!.activityCount).toBe(1);
    });

    it("should recover from stale state on activity", () => {
        // Manually set stale state (simulating internals or via response timeout)
        recordSessionActivity(sessionID);
        const health = getSessionHealth(sessionID)!;
        health.isStale = true;

        // Record activity
        recordSessionActivity(sessionID);

        expect(isSessionStale(sessionID)).toBe(false);
    });

    it("should update last response time", () => {
        recordSessionActivity(sessionID);
        const initial = getSessionHealth(sessionID)!.lastResponseTime;

        // Advance time
        vi.advanceTimersByTime(1000);
        vi.setSystemTime(new Date(2023, 1, 1, 0, 0, 1)); // Sync date

        recordSessionResponse(sessionID);

        const updated = getSessionHealth(sessionID)!.lastResponseTime;
        expect(updated).toBeGreaterThan(initial);
    });

    it("should detect stale session via health check", () => {
        // Setup initial state
        const start = new Date(2023, 1, 1, 0, 0, 0).getTime();
        vi.setSystemTime(start);

        // Initialize tracking (Must call activity first!)
        recordSessionActivity(sessionID);
        recordSessionResponse(sessionID);

        // Advance past threshold (10 minutes + 1 second)
        const future = start + 600000 + 1000;
        vi.setSystemTime(future);

        // Manually trigger check
        performHealthCheck();

        expect(isSessionStale(sessionID)).toBe(true);
        expect(getStaleSessions()).toContain(sessionID);
    });

    it("should not mark active sessions as stale", () => {
        // Setup initial
        const start = new Date(2023, 1, 1, 0, 0, 0).getTime();
        vi.setSystemTime(start);

        // Initialize tracking
        recordSessionActivity(sessionID);
        recordSessionResponse(sessionID);

        // Advance 5 minutes (safe zone)
        vi.setSystemTime(start + 300000);
        recordSessionResponse(sessionID); // Activity refreshes lastResponseTime

        // Advance another 5 minutes (total 10 minutes)
        vi.setSystemTime(start + 600000);

        // Trigger check
        performHealthCheck();

        // Should not be stale because response updated at T+5min.
        // Current T+10min. Elapsed = 5min. Threshold = 10min.
        expect(isSessionStale(sessionID)).toBe(false);
    });

    it("should cleanup session health data", () => {
        recordSessionActivity(sessionID);
        cleanupSessionHealth(sessionID);
        expect(getSessionHealth(sessionID)).toBeUndefined();
    });
});
