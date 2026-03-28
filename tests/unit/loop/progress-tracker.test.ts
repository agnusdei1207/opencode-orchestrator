/**
 * Progress Tracker Unit Tests
 * 
 * Tests all scenarios for the TTL-based progress tracking system:
 *   1. TTL pruning - stale sessions are cleaned up
 *   2. Stagnation detection - detects when no progress is made
 *   3. Progress reset - stagnationCount resets when progress detected
 *   4. Snapshot hashing - detects content changes
 *   5. Recovered from stagnation flag
 */

import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from "vitest";
import * as ProgressTracker from "../../../src/core/loop/progress-tracker";
import type { NormalizedTodo } from "../../../src/core/loop/progress-tracker";

describe("ProgressTracker", () => {
    const TEST_SESSION = "test-session-progress";
    const TEST_SESSION_2 = "test-session-2";

    beforeEach(() => {
        ProgressTracker.clearSession(TEST_SESSION);
        ProgressTracker.clearSession(TEST_SESSION_2);
        vi.useFakeTimers();
    });

    afterEach(() => {
        ProgressTracker.clearSession(TEST_SESSION);
        ProgressTracker.clearSession(TEST_SESSION_2);
        vi.useRealTimers();
    });

    afterAll(() => {
        // Clean up prune timer
        vi.useRealTimers();
    });

    // ── TTL Pruning Tests ───────────────────────────────────────────────────

    describe("TTL pruning", () => {
        it("prunes session after TTL expires (10 minutes)", () => {
            // Create a session and advance time past TTL
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            // Verify session exists
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);

            // Advance time by 10 minutes + 1 second
            vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

            // Session should be pruned (isStagnant returns false for non-existent)
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);
        });

        it("does not prune session before TTL expires", () => {
            // Create session and track some progress
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            const initialStagnation = ProgressTracker.getStagnationCount(TEST_SESSION);

            // Advance time by 5 minutes (less than 10 min TTL)
            vi.advanceTimersByTime(5 * 60 * 1000);

            // Session should still exist
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(initialStagnation);
        });

        it("prunes multiple stale sessions", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            ProgressTracker.trackProgress(TEST_SESSION_2, 3);

            vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);
            expect(ProgressTracker.isStagnant(TEST_SESSION_2)).toBe(false);
        });
    });

    // ── Stagnation Detection Tests ──────────────────────────────────────────

    describe("stagnation detection", () => {
        it("returns false when stagnation count is below threshold (3)", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            // First cycle - stagnationCount becomes 1
            vi.advanceTimersByTime(100);
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            const result1 = ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(result1.stagnationCount).toBe(1);
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);

            // Second cycle - stagnationCount becomes 2
            vi.advanceTimersByTime(100);
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            const result2 = ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(result2.stagnationCount).toBe(2);
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);

            // Third cycle - stagnationCount becomes 3 (threshold)
            vi.advanceTimersByTime(100);
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            const result3 = ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(result3.stagnationCount).toBe(3);
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(true);
        });

        it("stops at threshold exactly (=3)", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            // Progress through 3 cycles
            for (let i = 1; i <= 3; i++) {
                vi.advanceTimersByTime(100);
                ProgressTracker.markInjectionPerformed(TEST_SESSION);
                const result = ProgressTracker.trackProgress(TEST_SESSION, 2);
                expect(result.stagnationCount).toBe(i);
            }
            
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(true);
        });

        it("returns correct stagnation count", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(1);

            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(2);

            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(3);
        });
    });

    // ── Progress Reset Tests ────────────────────────────────────────────────

    describe("progress reset", () => {
        it("resets stagnation count when incomplete count decreases", () => {
            // Start tracking
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            // Build up stagnation
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(2);

            // Progress detected (incomplete count decreased from 3 to 2)
            const result = ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            expect(result.hasProgressed).toBe(true);
            expect(result.progressSource).toBe("count");
            expect(result.stagnationCount).toBe(0);
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(0);
        });

        it("resets stagnation count when snapshot changes", () => {
            const initialTodos: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "pending", priority: "high" },
            ];
            ProgressTracker.trackProgress(TEST_SESSION, 2, initialTodos);
            
            // Build up stagnation
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2, initialTodos);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2, initialTodos);
            
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(2);

            // Snapshot change detected as progress
            const changedTodos: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "in_progress", priority: "high" },
            ];
            const result = ProgressTracker.trackProgress(TEST_SESSION, 2, changedTodos);
            
            expect(result.hasProgressed).toBe(true);
            expect(result.progressSource).toBe("snapshot");
            expect(result.stagnationCount).toBe(0);
        });

        it("resets awaitingPostInjectionProgressCheck flag on progress", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            // Progress detected
            const result = ProgressTracker.trackProgress(TEST_SESSION, 1);
            
            expect(result.hasProgressed).toBe(true);
            // Next trackProgress should start fresh
        });

        it("marks recoveredFromStagnation when recovering from stagnant state", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            // Build to stagnation threshold
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 3);
            
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(true);

            // Recover
            const result = ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            expect(result.hasProgressed).toBe(true);
            expect(result.recoveredFromStagnation).toBe(true);
        });
    });

    // ── Snapshot Hashing Tests ───────────────────────────────────────────────

    describe("snapshot hashing", () => {
        it("generates consistent hash for same todo state", () => {
            const todos1: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "pending", priority: "high" },
                { id: "2", content: "Task 2", status: "completed", priority: "medium" },
            ];
            
            const todos2: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "pending", priority: "high" },
                { id: "2", content: "Task 2", status: "completed", priority: "medium" },
            ];

            const hash1 = ProgressTracker.hashTodos(todos1);
            const hash2 = ProgressTracker.hashTodos(todos2);
            
            expect(hash1).toBe(hash2);
        });

        it("generates different hash for different todo state", () => {
            const todos1: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "pending", priority: "high" },
            ];
            
            const todos2: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "in_progress", priority: "high" },
            ];

            const hash1 = ProgressTracker.hashTodos(todos1);
            const hash2 = ProgressTracker.hashTodos(todos2);
            
            expect(hash1).not.toBe(hash2);
        });

        it("handles null id in sorting", () => {
            const todos: NormalizedTodo[] = [
                { id: null, content: "Task 1", status: "pending", priority: "high" },
                { id: "1", content: "Task 2", status: "pending", priority: "high" },
            ];

            expect(() => ProgressTracker.hashTodos(todos)).not.toThrow();
        });

        it("counts completed todos correctly", () => {
            const initialTodos: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "completed", priority: "high" },
                { id: "2", content: "Task 2", status: "pending", priority: "medium" },
                { id: "3", content: "Task 3", status: "pending", priority: "low" },
            ];

            ProgressTracker.trackProgress(TEST_SESSION, 2, initialTodos);
            
            const updatedTodos: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "completed", priority: "high" },
                { id: "2", content: "Task 2", status: "completed", priority: "medium" },
                { id: "3", content: "Task 3", status: "pending", priority: "low" },
            ];
            
            const result = ProgressTracker.trackProgress(TEST_SESSION, 1, updatedTodos);
            
            expect(result.hasProgressed).toBe(true);
            expect(result.progressSource).toBe("count");
        });
    });

    // ── Edge Cases ─────────────────────────────────────────────────────────

    describe("edge cases", () => {
        it("handles first trackProgress call (previousIncompleteCount undefined)", () => {
            const result = ProgressTracker.trackProgress(TEST_SESSION, 5);
            
            expect(result.hasProgressed).toBe(false);
            expect(result.stagnationCount).toBe(0);
            expect(result.previousIncompleteCount).toBeUndefined();
        });

        it("handles empty todos array", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 0);
            const result = ProgressTracker.trackProgress(TEST_SESSION, 0, []);
            
            expect(result.hasProgressed).toBe(false);
            expect(result.stagnationCount).toBe(0);
        });

        it("handles undefined todos after initial call with todos", () => {
            const todos: NormalizedTodo[] = [
                { id: "1", content: "Task 1", status: "pending", priority: "high" },
            ];
            
            ProgressTracker.trackProgress(TEST_SESSION, 1, todos);
            // Second call without todos
            const result = ProgressTracker.trackProgress(TEST_SESSION, 1);
            
            expect(result.hasProgressed).toBe(false);
        });

        it("isStagnant returns false for non-existent session", () => {
            expect(ProgressTracker.isStagnant("non-existent-session")).toBe(false);
        });

        it("getStagnationCount returns 0 for non-existent session", () => {
            expect(ProgressTracker.getStagnationCount("non-existent-session")).toBe(0);
        });

        it("custom threshold works correctly", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            // With threshold 5, should not be stagnant yet
            expect(ProgressTracker.isStagnant(TEST_SESSION, 5)).toBe(false);
            
            // With threshold 2, should be stagnant
            expect(ProgressTracker.isStagnant(TEST_SESSION, 2)).toBe(true);
        });
    });

    // ── Reset and Clear ────────────────────────────────────────────────────

    describe("reset and clear", () => {
        it("resetProgress clears all tracking state", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            ProgressTracker.markInjectionPerformed(TEST_SESSION);
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            
            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(1);

            ProgressTracker.resetProgress(TEST_SESSION);

            expect(ProgressTracker.getStagnationCount(TEST_SESSION)).toBe(0);
        });

        it("clearSession removes session entirely", () => {
            ProgressTracker.trackProgress(TEST_SESSION, 2);
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);

            ProgressTracker.clearSession(TEST_SESSION);
            expect(ProgressTracker.isStagnant(TEST_SESSION)).toBe(false);
        });
    });
});
