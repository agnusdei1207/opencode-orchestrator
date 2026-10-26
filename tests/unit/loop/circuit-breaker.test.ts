import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    isCircuitOpen,
    detectRepetitiveOutput,
    tripOutputCircuit,
    recordAssistantTurn,
    clearCircuitState,
    getCircuitState,
    shutdownCircuitBreaker,
} from "../../../src/core/loop/circuit-breaker";

const REPEATED = "I will compress the context now.";

function recordIdleTurns(sessionID: string, text: string, count: number): void {
    for (let i = 0; i < count; i++) recordAssistantTurn(sessionID, text, 0);
}

describe("CircuitBreaker", () => {
    const TEST_SESSION = "test-session-circuit";
    const TEST_SESSION_2 = "test-session-2";

    beforeEach(() => {
        clearCircuitState(TEST_SESSION);
        clearCircuitState(TEST_SESSION_2);
    });

    afterEach(() => {
        clearCircuitState(TEST_SESSION);
        clearCircuitState(TEST_SESSION_2);
        shutdownCircuitBreaker();
    });

    it("isCircuitOpen returns false for non-existent session", () => {
        expect(isCircuitOpen(TEST_SESSION)).toBe(false);
    });

    it("isCircuitOpen returns false when circuit is closed", () => {
        recordAssistantTurn(TEST_SESSION, REPEATED, 0);
        expect(isCircuitOpen(TEST_SESSION)).toBe(false);
    });

    it("detectRepetitiveOutput returns false when history is empty or short", () => {
        expect(detectRepetitiveOutput(TEST_SESSION)).toBe(false);
        recordIdleTurns(TEST_SESSION, REPEATED, 2);
        expect(detectRepetitiveOutput(TEST_SESSION)).toBe(false);
    });

    it("detectRepetitiveOutput returns false for diverse answers", () => {
        for (let i = 0; i < 10; i++) {
            recordAssistantTurn(TEST_SESSION, `answer ${i % 3}`, 0);
        }
        expect(detectRepetitiveOutput(TEST_SESSION)).toBe(false);
    });

    it("detectRepetitiveOutput returns false if the pattern is broken", () => {
        recordIdleTurns(TEST_SESSION, REPEATED, 8);
        recordAssistantTurn(TEST_SESSION, "a different answer", 0);
        expect(detectRepetitiveOutput(TEST_SESSION)).toBe(false);
    });

    it("never opens for turns that call tools, however repetitive", () => {
        for (let i = 0; i < 5; i++) recordAssistantTurn(TEST_SESSION, REPEATED, 1);
        expect(tripOutputCircuit(TEST_SESSION)).toBe(false);
        expect(isCircuitOpen(TEST_SESSION)).toBe(false);
    });

    it("tripOutputCircuit opens once for repeated output", () => {
        recordIdleTurns(TEST_SESSION, REPEATED, 3);
        expect(tripOutputCircuit(TEST_SESSION)).toBe(true);
        expect(tripOutputCircuit(TEST_SESSION)).toBe(false);
        expect(isCircuitOpen(TEST_SESSION)).toBe(true);
        expect(getCircuitState(TEST_SESSION)?.isOpen).toBe(true);
    });

    it("tripOutputCircuit returns false for a non-existent session", () => {
        expect(tripOutputCircuit(TEST_SESSION)).toBe(false);
    });

    it("recordAssistantTurn respects HISTORY_SIZE", () => {
        for (let i = 0; i < 15; i++) {
            recordAssistantTurn(TEST_SESSION, `answer ${i}`, 0);
        }
        const state = getCircuitState(TEST_SESSION);
        expect(state?.idleTurnHistory.length).toBeLessThanOrEqual(10);
    });

    it("recordAssistantTurn updates lastAccessedAt", () => {
        const before = getCircuitState(TEST_SESSION);

        recordAssistantTurn(TEST_SESSION, REPEATED, 0);

        const after = getCircuitState(TEST_SESSION);
        expect(after?.lastAccessedAt).toBeGreaterThanOrEqual(before?.lastAccessedAt ?? 0);
    });

    it("clearCircuitState removes session state", () => {
        recordAssistantTurn(TEST_SESSION, REPEATED, 0);
        expect(getCircuitState(TEST_SESSION)).toBeDefined();

        clearCircuitState(TEST_SESSION);
        expect(getCircuitState(TEST_SESSION)).toBeUndefined();
    });

    it("clearCircuitState handles non-existent session", () => {
        expect(() => clearCircuitState("non-existent")).not.toThrow();
    });

    it("getCircuitState returns undefined for non-existent session", () => {
        expect(getCircuitState("non-existent")).toBeUndefined();
    });

    it("getCircuitState returns correct state shape", () => {
        recordAssistantTurn(TEST_SESSION, REPEATED, 0);
        const state = getCircuitState(TEST_SESSION);

        expect(state).toHaveProperty("lastAccessedAt");
        expect(state).toHaveProperty("lastTrippedAt");
        expect(state).toHaveProperty("isOpen");
        expect(state).toHaveProperty("idleTurnHistory");
        expect(state?.isOpen).toBe(false);
    });

    it("multiple sessions are isolated", () => {
        recordIdleTurns(TEST_SESSION, REPEATED, 3);
        recordIdleTurns(TEST_SESSION_2, "another answer", 3);

        expect(tripOutputCircuit(TEST_SESSION)).toBe(true);
        expect(isCircuitOpen(TEST_SESSION_2)).toBe(false);
        expect(getCircuitState(TEST_SESSION)?.idleTurnHistory)
            .not.toEqual(getCircuitState(TEST_SESSION_2)?.idleTurnHistory);
    });

    it("shutdownCircuitBreaker clears all state", () => {
        recordAssistantTurn(TEST_SESSION, REPEATED, 0);
        recordAssistantTurn(TEST_SESSION_2, "another answer", 0);

        shutdownCircuitBreaker();

        expect(getCircuitState(TEST_SESSION)).toBeUndefined();
        expect(getCircuitState(TEST_SESSION_2)).toBeUndefined();
    });
});
