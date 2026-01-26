/**
 * Continuation Lock Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    tryAcquireContinuationLock,
    releaseContinuationLock,
    hasContinuationLock,
    cleanupContinuationLock,
    clearAllLocks,
} from "../../src/core/loop/continuation-lock.js";

describe("ContinuationLock", () => {
    const testSessionID = "test-session-12345678";

    beforeEach(() => {
        clearAllLocks();
    });

    describe("tryAcquireContinuationLock", () => {
        it("should acquire lock for new session", () => {
            const acquired = tryAcquireContinuationLock(testSessionID, "test");
            expect(acquired).toBe(true);
        });

        it("should reject duplicate lock from same session", () => {
            tryAcquireContinuationLock(testSessionID, "first");
            const second = tryAcquireContinuationLock(testSessionID, "second");
            expect(second).toBe(false);
        });

        it("should allow locks for different sessions", () => {
            const first = tryAcquireContinuationLock("session-1", "test");
            const second = tryAcquireContinuationLock("session-2", "test");
            expect(first).toBe(true);
            expect(second).toBe(true);
        });

        it("should record source for debugging", () => {
            tryAcquireContinuationLock(testSessionID, "mission-loop");
            // Try to acquire from different source
            const acquired = tryAcquireContinuationLock(testSessionID, "todo-continuation");
            expect(acquired).toBe(false);
        });
    });

    describe("releaseContinuationLock", () => {
        it("should release acquired lock", () => {
            tryAcquireContinuationLock(testSessionID, "test");
            releaseContinuationLock(testSessionID);

            // Can re-acquire after release
            const acquired = tryAcquireContinuationLock(testSessionID, "test");
            expect(acquired).toBe(true);
        });

        it("should handle releasing non-existent lock gracefully", () => {
            expect(() => releaseContinuationLock("non-existent")).not.toThrow();
        });
    });

    describe("hasContinuationLock", () => {
        it("should return true when lock is held", () => {
            tryAcquireContinuationLock(testSessionID, "test");
            expect(hasContinuationLock(testSessionID)).toBe(true);
        });

        it("should return false when no lock", () => {
            expect(hasContinuationLock(testSessionID)).toBe(false);
        });

        it("should return false after lock is released", () => {
            tryAcquireContinuationLock(testSessionID, "test");
            releaseContinuationLock(testSessionID);
            expect(hasContinuationLock(testSessionID)).toBe(false);
        });
    });

    describe("cleanupContinuationLock", () => {
        it("should cleanup session lock", () => {
            tryAcquireContinuationLock(testSessionID, "test");
            cleanupContinuationLock(testSessionID);
            expect(hasContinuationLock(testSessionID)).toBe(false);
        });
    });

    describe("timeout behavior", () => {
        it("should allow reacquisition after timeout", async () => {
            vi.useFakeTimers();

            tryAcquireContinuationLock(testSessionID, "test");

            // Simulate 31 seconds (timeout is 30s)
            vi.advanceTimersByTime(31000);

            // Should allow re-acquire
            const acquired = tryAcquireContinuationLock(testSessionID, "new-test");
            expect(acquired).toBe(true);

            vi.useRealTimers();
        });

        it("should reject reacquisition before timeout", async () => {
            vi.useFakeTimers();

            tryAcquireContinuationLock(testSessionID, "test");

            // Simulate 29 seconds (timeout is 30s)
            vi.advanceTimersByTime(29000);

            // Should still reject
            const acquired = tryAcquireContinuationLock(testSessionID, "new-test");
            expect(acquired).toBe(false);

            vi.useRealTimers();
        });
    });
});
