import { describe, expect, it } from "vitest";
import { generateMissionContinuationPrompt } from "../../src/core/loop/mission-loop.js";
import type { MissionLoopState } from "../../src/shared/loop/types.js";

function stateWith(stagnationCount: number): MissionLoopState {
    return {
        active: true,
        iteration: 3,
        maxIterations: 1_000_000_000,
        prompt: "Implement the feature",
        objective: "Implement the feature",
        sessionID: "s1",
        startedAt: new Date(0).toISOString(),
        stagnationCount,
    };
}

describe("mission continuation: self-review + escalation (Phase D)", () => {
    it("always asks for a completion self-account", () => {
        const prompt = generateMissionContinuationPrompt(stateWith(0));
        expect(prompt).toContain("self-account");
        expect(prompt).not.toContain("<escalation");
    });

    it("escalates after sustained stagnation instead of blind retry", () => {
        const prompt = generateMissionContinuationPrompt(stateWith(5));
        expect(prompt).toContain("<escalation");
        expect(prompt).toContain("DECOMPOSE");
        expect(prompt).toContain("ASK the user");
    });

    it("does not escalate below the threshold", () => {
        expect(generateMissionContinuationPrompt(stateWith(4))).not.toContain("<escalation");
    });
});
