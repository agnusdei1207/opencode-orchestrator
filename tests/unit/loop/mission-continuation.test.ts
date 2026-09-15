import { describe, expect, it } from "vitest";
import {
    applyContinuationMetadata,
    getVerificationRemainingCount,
} from "../../../src/core/loop/mission-continuation.js";
import type { MissionLoopState } from "../../../src/shared/loop/types.js";
import type { VerificationResult } from "../../../src/shared/verification/types.js";

function verification(overrides: Partial<VerificationResult> = {}): VerificationResult {
    return {
        passed: false,
        todoComplete: false,
        todoPresent: true,
        todoProgress: "1/3",
        todoIncomplete: 2,
        syncIssuesEmpty: true,
        syncIssuesCount: 0,
        checklistComplete: false,
        checklistPresent: true,
        checklistProgress: "2/5",
        errors: [],
        ...overrides,
    };
}

function loopState(): MissionLoopState {
    return {
        active: true,
        iteration: 2,
        maxIterations: 10,
        prompt: "Finish the task",
        sessionID: "session-1",
        startedAt: "2026-09-15T00:00:00.000Z",
        stagnationCount: 2,
    };
}

describe("mission continuation policy", () => {
    it("counts TODO, checklist, and unresolved sync evidence", () => {
        expect(getVerificationRemainingCount(verification({
            syncIssuesEmpty: false,
            syncIssuesCount: 0,
        }))).toBe(6);
    });

    it("treats malformed checklist progress as no count", () => {
        expect(getVerificationRemainingCount(verification({
            todoIncomplete: 1,
            checklistProgress: "unknown",
            syncIssuesEmpty: true,
        }))).toBe(1);
    });

    it("builds immutable stagnation metadata", () => {
        const original = loopState();
        const updated = applyContinuationMetadata(original, {
            progress: "TODO: 1/3",
            verificationSummary: "2 TODO items remain",
            stagnant: true,
            scheduledAt: Date.parse("2026-09-15T01:02:03.000Z"),
        });

        expect(updated).not.toBe(original);
        expect(original.stagnationCount).toBe(2);
        expect(updated).toMatchObject({
            lastProgress: "TODO: 1/3",
            stagnationCount: 3,
            lastVerificationSummary: "2 TODO items remain",
            lastContinuationReason: "stagnation_intervention",
            lastContinuationAt: "2026-09-15T01:02:03.000Z",
        });
    });

    it("resets stagnation metadata when progress is still changing", () => {
        const updated = applyContinuationMetadata(loopState(), {
            progress: "TODO: 2/3",
            verificationSummary: "1 TODO item remains",
            stagnant: false,
            scheduledAt: Date.parse("2026-09-15T01:02:03.000Z"),
        });

        expect(updated.stagnationCount).toBe(0);
        expect(updated.lastContinuationReason).toBe("verification_failed");
    });
});
