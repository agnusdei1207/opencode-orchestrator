/**
 * Progress Tracker Unit Tests
 *
 * The tracker counts mission checks that made no progress after a
 * continuation was injected:
 *   1. Stagnation only accrues after markInjectionPerformed
 *   2. A lower incomplete count resets the stagnation count
 *   3. TTL pruning drops stale sessions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as ProgressTracker from "../../../src/core/loop/progress-tracker";

describe("ProgressTracker", () => {
    const TEST_SESSION = "test-session-progress";
    const TEST_SESSION_2 = "test-session-2";

    /** One injected-but-unproductive cycle; returns the resulting count. */
    function stagnantCycle(sessionID: string, incomplete: number): number {
        ProgressTracker.markInjectionPerformed(sessionID);
        return ProgressTracker.trackProgress(sessionID, incomplete);
    }

    beforeEach(() => {
        vi.useFakeTimers();
        // Re-arm the prune interval under fake timers.
        ProgressTracker.shutdownProgressTracker();
    });

    afterEach(() => {
        ProgressTracker.shutdownProgressTracker();
        vi.useRealTimers();
    });

    describe("TTL pruning", () => {
        it("prunes session after TTL expires (10 minutes)", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(stagnantCycle(TEST_SESSION, 2)).toBe(1);

            // TTL (10 min) plus one prune interval (2 min).
            vi.advanceTimersByTime(12 * 60 * 1000 + 1000);

            // A pruned session has no previous count, so it starts at zero.
            expect(stagnantCycle(TEST_SESSION, 2)).toBe(0);
        });

        it("does not prune session before TTL expires", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(stagnantCycle(TEST_SESSION, 2)).toBe(1);

            vi.advanceTimersByTime(5 * 60 * 1000);

            expect(stagnantCycle(TEST_SESSION, 2)).toBe(2);
        });

        it("prunes multiple stale sessions", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            ProgressTracker.trackProgress(TEST_SESSION_2, 3);
            stagnantCycle(TEST_SESSION, 2);
            stagnantCycle(TEST_SESSION_2, 3);

            vi.advanceTimersByTime(12 * 60 * 1000 + 1000);

            expect(stagnantCycle(TEST_SESSION, 2)).toBe(0);
            expect(stagnantCycle(TEST_SESSION_2, 3)).toBe(0);
        });
    });

    describe("stagnation detection", () => {
        it("counts one stagnant check per injected cycle up to the threshold", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);

            for (let i = 1; i <= ProgressTracker.DEFAULT_STAGNATION_THRESHOLD; i++) {
                vi.advanceTimersByTime(100);
                expect(stagnantCycle(TEST_SESSION, 2)).toBe(i);
            }
        });

        it("uses a default threshold of 3", () => {
            expect(ProgressTracker.DEFAULT_STAGNATION_THRESHOLD).toBe(3);
        });

        it("does not count checks without an injection as stagnant", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(ProgressTracker.trackProgress(TEST_SESSION, 2)).toBe(0);
            expect(ProgressTracker.trackProgress(TEST_SESSION, 2)).toBe(0);
        });

        it("keeps counting while the awaiting flag stays set", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            expect(ProgressTracker.trackProgress(TEST_SESSION, 2)).toBe(1);
            expect(ProgressTracker.trackProgress(TEST_SESSION, 2)).toBe(2);
        });

        it("treats an increased incomplete count as no progress", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(stagnantCycle(TEST_SESSION, 4)).toBe(1);
        });

        it("isolates sessions", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            ProgressTracker.trackProgress(TEST_SESSION_2, 2);
            stagnantCycle(TEST_SESSION, 2);
            stagnantCycle(TEST_SESSION, 2);

            expect(ProgressTracker.trackProgress(TEST_SESSION_2, 2)).toBe(0);
        });
    });

    describe("progress reset", () => {
        it("resets stagnation count when incomplete count decreases", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            stagnantCycle(TEST_SESSION, 3);
            expect(stagnantCycle(TEST_SESSION, 3)).toBe(2);

            expect(ProgressTracker.trackProgress(TEST_SESSION, 2)).toBe(0);
        });

        it("clears the awaiting flag on progress", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            stagnantCycle(TEST_SESSION, 2);

            expect(ProgressTracker.trackProgress(TEST_SESSION, 1)).toBe(0);
            // No new injection, so an unchanged count is not stagnation.
            expect(ProgressTracker.trackProgress(TEST_SESSION, 1)).toBe(0);
        });
    });

    describe("edge cases", () => {
        it("handles the first trackProgress call", () => {
            expect(ProgressTracker.trackProgress(TEST_SESSION, 5)).toBe(0);
        });

        it("ignores an injection marked before the first count", () => {
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            expect(ProgressTracker.trackProgress(TEST_SESSION, 2)).toBe(0);
        });
    });

    describe("clear", () => {
        it("clearSession removes session entirely", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(stagnantCycle(TEST_SESSION, 2)).toBe(1);

            ProgressTracker.clearSession(TEST_SESSION);

            expect(stagnantCycle(TEST_SESSION, 2)).toBe(0);
        });

        it("shutdownProgressTracker drops all sessions", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            stagnantCycle(TEST_SESSION, 2);

            ProgressTracker.shutdownProgressTracker();

            expect(stagnantCycle(TEST_SESSION, 2)).toBe(0);
        });
    });
});
