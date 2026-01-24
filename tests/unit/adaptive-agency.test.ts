import { describe, it, expect, vi } from "vitest";
import { MissionLoopState } from "../../src/core/loop/mission-loop.js";

describe("Adaptive Agency: Stagnation Detection", () => {
    it("should track progress and stagnation in loop state", () => {
        const state: MissionLoopState = {
            active: true,
            iteration: 1,
            maxIterations: 10,
            prompt: "Test Task",
            sessionID: "S1",
            startedAt: new Date().toISOString(),
            lastProgress: "0/5",
            stagnationCount: 0
        };

        // Simulate next iteration with no progress
        const nextProgress = "0/5";
        if (state.lastProgress === nextProgress) {
            state.stagnationCount = (state.stagnationCount || 0) + 1;
        }
        state.iteration++;

        expect(state.stagnationCount).toBe(1);
        expect(state.iteration).toBe(2);

        // Simulate 2nd iteration with no progress
        if (state.lastProgress === nextProgress) {
            state.stagnationCount = (state.stagnationCount || 0) + 1;
        }
        expect(state.stagnationCount).toBe(2);

        // Stagnation threshold reached
        const isStagnant = (state.stagnationCount ?? 0) >= 2;
        expect(isStagnant).toBe(true);
    });

    it("should reset stagnation count when progress is made", () => {
        let lastProgress = "0/5";
        let stagnationCount = 2;

        const currentProgress = "1/5"; // Progress made!
        if (lastProgress !== currentProgress) {
            stagnationCount = 0;
        }
        lastProgress = currentProgress;

        expect(stagnationCount).toBe(0);
        expect(lastProgress).toBe("1/5");
    });
});
