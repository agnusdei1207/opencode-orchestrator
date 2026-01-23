/**
 * Mission Loop Lifecycle Tests
 * 
 * E2E tests for:
 * - Mission loop state management
 * - Loop continuation logic
 * - Progressive iteration tracking
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
    generateMissionContinuationPrompt,
    type MissionLoopState,
} from "../../src/core/loop/mission-loop";
import { MISSION_CONTROL } from "../../src/shared";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

describe("Mission Loop Lifecycle E2E", () => {
    let testDir: string;
    const testSessionID = "test_session_123";

    beforeEach(() => {
        testDir = path.join(tmpdir(), `mission-loop-test-${Date.now()}`);
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
            expect(state?.maxIterations).toBe(MISSION_CONTROL.DEFAULT_MAX_ITERATIONS);
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
    // Mission Loop Constants
    // ========================================================================

    describe("mission loop constants", () => {
        it("should have all required constants", () => {
            expect(MISSION_CONTROL.DEFAULT_MAX_ITERATIONS).toBeGreaterThan(0);
            expect(MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS).toBeGreaterThan(0);
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
                const prompt = generateMissionContinuationPrompt(state, testDir);
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
                const prompt = generateMissionContinuationPrompt(state, testDir);
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

            // 3. Mission completed
            clearLoopState(testDir);
            expect(isLoopActive(testDir, testSessionID)).toBe(false);
        });
    });
});
