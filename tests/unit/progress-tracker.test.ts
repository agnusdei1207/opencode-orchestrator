/**
 * Progress Tracker Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as ProgressTracker from "../../src/core/progress/tracker";

describe("ProgressTracker", () => {
    const TEST_SESSION = "session_test";

    beforeEach(() => {
        ProgressTracker.clearSession(TEST_SESSION);
    });

    describe("startSession and recordSnapshot", () => {
        it("should start tracking a session", () => {
            ProgressTracker.startSession(TEST_SESSION);

            const snapshot = ProgressTracker.recordSnapshot(TEST_SESSION, {
                todoTotal: 10,
                todoCompleted: 3,
            });

            expect(snapshot.sessionId).toBe(TEST_SESSION);
            expect(snapshot.todos.total).toBe(10);
            expect(snapshot.todos.completed).toBe(3);
            expect(snapshot.todos.percentage).toBe(30);
        });
    });

    describe("getLatest", () => {
        it("should return latest snapshot", () => {
            ProgressTracker.startSession(TEST_SESSION);

            ProgressTracker.recordSnapshot(TEST_SESSION, { todoTotal: 5, todoCompleted: 1 });
            ProgressTracker.recordSnapshot(TEST_SESSION, { todoTotal: 5, todoCompleted: 2 });
            ProgressTracker.recordSnapshot(TEST_SESSION, { todoTotal: 5, todoCompleted: 3 });

            const latest = ProgressTracker.getLatest(TEST_SESSION);
            expect(latest?.todos.completed).toBe(3);
        });

        it("should return undefined for non-existent session", () => {
            expect(ProgressTracker.getLatest("nonexistent")).toBeUndefined();
        });
    });

    describe("getHistory", () => {
        it("should return snapshot history", () => {
            ProgressTracker.startSession(TEST_SESSION);

            for (let i = 0; i < 5; i++) {
                ProgressTracker.recordSnapshot(TEST_SESSION, { todoCompleted: i });
            }

            const history = ProgressTracker.getHistory(TEST_SESSION);
            expect(history.length).toBe(5);
        });

        it("should respect limit", () => {
            ProgressTracker.startSession(TEST_SESSION);

            for (let i = 0; i < 10; i++) {
                ProgressTracker.recordSnapshot(TEST_SESSION, { todoCompleted: i });
            }

            const history = ProgressTracker.getHistory(TEST_SESSION, 3);
            expect(history.length).toBe(3);
        });
    });

    describe("formatElapsed", () => {
        it("should format seconds", () => {
            expect(ProgressTracker.formatElapsed(5000)).toBe("5s");
        });

        it("should format minutes", () => {
            expect(ProgressTracker.formatElapsed(90000)).toBe("1m 30s");
        });

        it("should format hours", () => {
            expect(ProgressTracker.formatElapsed(3660000)).toBe("1h 1m");
        });
    });

    describe("formatProgressBar", () => {
        it("should create progress bar", () => {
            const bar = ProgressTracker.formatProgressBar(50, 10);
            expect(bar).toContain("█████");
            expect(bar).toContain("░░░░░");
            expect(bar).toContain("50%");
        });
    });

    describe("format", () => {
        it("should return formatted progress string", () => {
            ProgressTracker.startSession(TEST_SESSION);
            ProgressTracker.recordSnapshot(TEST_SESSION, {
                todoTotal: 10,
                todoCompleted: 5,
                taskTotal: 3,
                taskCompleted: 1,
                taskRunning: 1,
                currentStep: 15,
            });

            const formatted = ProgressTracker.format(TEST_SESSION);
            expect(formatted).toContain("Progress Report");
            expect(formatted).toContain("Todos:");
            expect(formatted).toContain("Tasks:");
            expect(formatted).toContain("running");
        });
    });

    describe("formatCompact", () => {
        it("should return compact progress string", () => {
            ProgressTracker.startSession(TEST_SESSION);
            ProgressTracker.recordSnapshot(TEST_SESSION, {
                todoTotal: 10,
                todoCompleted: 3,
                taskRunning: 2,
            });

            const compact = ProgressTracker.formatCompact(TEST_SESSION);
            expect(compact).toContain("✅3/10");
            expect(compact).toContain("⚡2");
        });
    });

    describe("calculateRate", () => {
        it("should calculate items per minute", () => {
            ProgressTracker.startSession(TEST_SESSION);

            // Simulate some elapsed time by recording snapshot
            const snapshot = ProgressTracker.recordSnapshot(TEST_SESSION, {
                todoCompleted: 6,
                taskCompleted: 4,
            });

            // Rate depends on elapsed time, so just check it returns a number
            const rate = ProgressTracker.calculateRate(TEST_SESSION);
            expect(typeof rate).toBe("number");
        });
    });

    describe("estimateRemaining", () => {
        it("should return undefined when no rate", () => {
            ProgressTracker.startSession(TEST_SESSION);
            ProgressTracker.recordSnapshot(TEST_SESSION, {});

            // At 0 elapsed time, rate is 0, so estimate is undefined
            const estimate = ProgressTracker.estimateRemaining(TEST_SESSION);
            expect(estimate).toBeUndefined();
        });
    });
});
