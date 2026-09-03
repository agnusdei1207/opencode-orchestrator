import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateRate, estimateRemaining } from "../../src/core/progress/calculator.js";
import * as store from "../../src/core/progress/store.js";

describe("Progress Calculator", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("calculates completion rate in items per minute", () => {
        vi.spyOn(store, "getLatest").mockReturnValue({
            sessionId: "s1",
            timestamp: new Date(),
            elapsedMs: 120000, // 2 minutes
            todos: { total: 10, completed: 4, inProgress: 1, pending: 5, percentage: 40 },
            tasks: { total: 4, running: 1, completed: 2, failed: 1, depth: 1 },
        });

        // 4 completed todos + 2 completed tasks = 6 items in 2 min = 3 items/min
        const rate = calculateRate("s1");
        expect(rate).toBe(3);
    });

    it("returns 0 rate when elapsedMs is 0 or snapshot missing", () => {
        vi.spyOn(store, "getLatest").mockReturnValue(undefined);
        expect(calculateRate("s1")).toBe(0);

        vi.spyOn(store, "getLatest").mockReturnValue({
            sessionId: "s1",
            timestamp: new Date(),
            elapsedMs: 0,
            todos: { total: 0, completed: 0, inProgress: 0, pending: 0, percentage: 0 },
            tasks: { total: 0, running: 0, completed: 0, failed: 0, depth: 0 },
        });
        expect(calculateRate("s1")).toBe(0);
    });

    it("estimates remaining time in milliseconds", () => {
        vi.spyOn(store, "getLatest").mockReturnValue({
            sessionId: "s1",
            timestamp: new Date(),
            elapsedMs: 60000, // 1 minute
            todos: { total: 10, completed: 2, inProgress: 0, pending: 8, percentage: 20 },
            tasks: { total: 6, running: 0, completed: 2, failed: 0, depth: 1 },
        });

        // completed: 2 + 2 = 4 items in 1 min => rate = 4 items/min
        // remaining: 8 todos pending + (6 tasks total - 2 completed - 0 failed = 4) = 12 items
        // time = 12 / 4 * 60000 = 180000 ms (3 minutes)
        const est = estimateRemaining("s1");
        expect(est).toBe(180000);
    });

    it("returns undefined for estimateRemaining when snapshot missing or rate 0", () => {
        vi.spyOn(store, "getLatest").mockReturnValue(undefined);
        expect(estimateRemaining("s1")).toBeUndefined();

        vi.spyOn(store, "getLatest").mockReturnValue({
            sessionId: "s1",
            timestamp: new Date(),
            elapsedMs: 60000,
            todos: { total: 0, completed: 0, inProgress: 0, pending: 0, percentage: 0 },
            tasks: { total: 0, running: 0, completed: 0, failed: 0, depth: 0 },
        });
        expect(estimateRemaining("s1")).toBeUndefined();
    });
});
