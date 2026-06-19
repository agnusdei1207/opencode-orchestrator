import { describe, expect, it } from "vitest";
import {
    NEUTRAL_WEIGHTS,
    horizonForLevel,
    weightsForRole,
} from "../../src/core/knowledge/retrieval-weights.js";

describe("retrieval weights", () => {
    it("returns neutral weights for unknown or missing role", () => {
        expect(weightsForRole()).toEqual(NEUTRAL_WEIGHTS);
        expect(weightsForRole("nobody")).toEqual(NEUTRAL_WEIGHTS);
    });

    it("biases worker toward lexical and planner toward graph", () => {
        const worker = weightsForRole("Worker");
        const planner = weightsForRole("planner");
        expect(worker.lexical).toBeGreaterThan(worker.graph);
        expect(planner.graph).toBeGreaterThan(planner.lexical);
    });

    it("maps memory levels to horizons", () => {
        expect(horizonForLevel("system")).toBe("strategic");
        expect(horizonForLevel("project")).toBe("strategic");
        expect(horizonForLevel("mission")).toBe("execution");
        expect(horizonForLevel("task")).toBe("closure");
        expect(horizonForLevel("unknown")).toBe("execution");
    });
});
