/**
 * Mission Seal Lifecycle Tests
 * 
 * E2E tests for:
 * - Mission seal detection
 * - Loop continuation logic
 * - Seal validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import {
    isLoopActive,
    readLoopState,
    startMissionLoop,
    incrementIteration,
    clearLoopState,
    detectSealInText,
    generateMissionContinuationPrompt,
    SEAL_REGEX,
    type MissionLoopState,
} from "../../src/core/loop/mission-seal";
import { MISSION_SEAL } from "../../src/shared";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

describe("Mission Seal Lifecycle E2E", () => {
    let testDir: string;
    const testSessionID = "test_session_123";

    beforeEach(() => {
        testDir = path.join(tmpdir(), `mission-seal-test-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });
        fs.mkdirSync(path.join(testDir, ".opencode"), { recursive: true });
    });

    afterEach(() => {
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ========================================================================
    // Loop Initialization
    // ========================================================================

    describe("loop initialization", () => {
        it("should initialize a new loop", () => {
            const prompt = "Build REST API";
            startMissionLoop(testDir, testSessionID, prompt);

            expect(isLoopActive(testDir, testSessionID)).toBe(true);

            const state = readLoopState(testDir);
            expect(state).not.toBeNull();
            expect(state?.active).toBe(true);
            expect(state?.iteration).toBe(1);
            expect(state?.prompt).toBe(prompt);
        });

        it("should set default max iterations", () => {
            startMissionLoop(testDir, testSessionID, "Test task");

            const state = readLoopState(testDir);
            expect(state?.maxIterations).toBe(MISSION_SEAL.DEFAULT_MAX_ITERATIONS);
        });

        it("should allow custom max iterations", () => {
            startMissionLoop(testDir, testSessionID, "Test task", { maxIterations: 50 });

            const state = readLoopState(testDir);
            expect(state?.maxIterations).toBe(50);
        });
    });

    // ========================================================================
    // Loop Iteration
    // ========================================================================

    describe("loop iteration", () => {
        it("should increment iteration count", () => {
            startMissionLoop(testDir, testSessionID, "Test task");

            incrementIteration(testDir);
            let state = readLoopState(testDir);
            expect(state?.iteration).toBe(2);

            incrementIteration(testDir);
            state = readLoopState(testDir);
            expect(state?.iteration).toBe(3);
        });

        it("should return updated state after increment", () => {
            startMissionLoop(testDir, testSessionID, "Test task");

            const newState = incrementIteration(testDir);
            expect(newState?.iteration).toBe(2);
        });
    });

    // ========================================================================
    // Loop Completion
    // ========================================================================

    describe("loop completion", () => {
        it("should clear loop state", () => {
            startMissionLoop(testDir, testSessionID, "Test task");
            expect(isLoopActive(testDir, testSessionID)).toBe(true);

            clearLoopState(testDir);
            expect(isLoopActive(testDir, testSessionID)).toBe(false);
        });

        it("should return null state after clear", () => {
            startMissionLoop(testDir, testSessionID, "Test task");
            clearLoopState(testDir);

            const state = readLoopState(testDir);
            expect(state).toBeNull();
        });
    });

    // ========================================================================
    // Seal Pattern Detection
    // ========================================================================

    describe("seal pattern detection", () => {
        it("should define correct seal pattern", () => {
            expect(MISSION_SEAL.PATTERN).toBe("<mission_seal>SEALED</mission_seal>");
        });

        it("should detect seal in text using function", () => {
            const textWithSeal = `
                Task completed successfully.
                All tests passing.
                <mission_seal>SEALED</mission_seal>
            `;

            expect(detectSealInText(textWithSeal)).toBe(true);
        });

        it("should detect seal in text using regex", () => {
            const textWithSeal = "Done! <mission_seal>SEALED</mission_seal>";
            expect(SEAL_REGEX.test(textWithSeal)).toBe(true);
        });

        it("should not detect partial seal", () => {
            const partialSeal = "<mission_seal>PENDING</mission_seal>";
            expect(detectSealInText(partialSeal)).toBe(false);
        });

        it("should handle whitespace in seal tag", () => {
            const sealWithWhitespace = "<mission_seal> SEALED </mission_seal>";
            expect(SEAL_REGEX.test(sealWithWhitespace)).toBe(true);
        });
    });

    // ========================================================================
    // Mission Seal Constants
    // ========================================================================

    describe("mission seal constants", () => {
        it("should have all required constants", () => {
            expect(MISSION_SEAL.TAG).toBe("mission_seal");
            expect(MISSION_SEAL.CONFIRMATION).toBe("SEALED");
            expect(MISSION_SEAL.PATTERN).toBeDefined();
            expect(MISSION_SEAL.DEFAULT_MAX_ITERATIONS).toBeGreaterThan(0);
            expect(MISSION_SEAL.DEFAULT_COUNTDOWN_SECONDS).toBeGreaterThan(0);
        });

        it("should have stop and cancel commands", () => {
            expect(MISSION_SEAL.STOP_COMMAND).toBe("/stop");
            expect(MISSION_SEAL.CANCEL_COMMAND).toBe("/cancel");
        });
    });

    // ========================================================================
    // Continuation Prompt Generation
    // ========================================================================

    describe("continuation prompt generation", () => {
        it("should generate continuation prompt", () => {
            startMissionLoop(testDir, testSessionID, "Build API");
            const state = readLoopState(testDir);

            if (state) {
                const prompt = generateMissionContinuationPrompt(state);
                expect(prompt).toContain("mission_loop");
                expect(prompt).toContain("Build API");
            }
        });

        it("should include iteration info in prompt", () => {
            startMissionLoop(testDir, testSessionID, "Test task");
            incrementIteration(testDir);
            incrementIteration(testDir);

            const state = readLoopState(testDir);
            if (state) {
                const prompt = generateMissionContinuationPrompt(state);
                expect(prompt).toContain("3"); // iteration 3
            }
        });
    });

    // ========================================================================
    // Full Lifecycle
    // ========================================================================

    describe("full lifecycle", () => {
        it("should handle complete mission lifecycle", () => {
            const prompt = "Implement user authentication";

            // 1. Start mission
            startMissionLoop(testDir, testSessionID, prompt);
            expect(isLoopActive(testDir, testSessionID)).toBe(true);

            // 2. Simulate iterations
            for (let i = 0; i < 3; i++) {
                incrementIteration(testDir);
            }

            const state = readLoopState(testDir);
            expect(state?.iteration).toBe(4);

            // 3. Mission sealed
            clearLoopState(testDir);
            expect(isLoopActive(testDir, testSessionID)).toBe(false);
        });
    });
});
