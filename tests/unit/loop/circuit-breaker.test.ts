import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    isCircuitOpen,
    detectRepetitiveToolUse,
    shouldTripCircuit,
    recordToolCall,
    clearCircuitState,
    getCircuitState,
    shutdownCircuitBreaker,
} from "../../../src/core/loop/circuit-breaker";

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
        recordToolCall(TEST_SESSION, "read");
        expect(isCircuitOpen(TEST_SESSION)).toBe(false);
    });

    it("detectRepetitiveToolUse returns null when history is empty", () => {
        expect(detectRepetitiveToolUse(TEST_SESSION)).toBeNull();
    });

    it("detectRepetitiveToolUse returns null when history is short", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        expect(detectRepetitiveToolUse(TEST_SESSION)).toBeNull();
    });

    it("detectRepetitiveToolUse returns null for diverse tools", () => {
        for (let i = 0; i < 10; i++) {
            recordToolCall(TEST_SESSION, `tool-${i % 3}`);
        }
        expect(detectRepetitiveToolUse(TEST_SESSION)).toBeNull();
    });

    it("detectRepetitiveToolUse returns tool name for 3+ consecutive same", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        expect(detectRepetitiveToolUse(TEST_SESSION)).toBeNull();
        
        recordToolCall(TEST_SESSION, "read");
        expect(detectRepetitiveToolUse(TEST_SESSION)).toBe("read");
    });

    it("detectRepetitiveToolUse returns null if pattern is broken", () => {
        for (let i = 0; i < 8; i++) {
            recordToolCall(TEST_SESSION, "read");
        }
        recordToolCall(TEST_SESSION, "edit");
        recordToolCall(TEST_SESSION, "edit");
        recordToolCall(TEST_SESSION, "grep");
        recordToolCall(TEST_SESSION, "bash");
        expect(detectRepetitiveToolUse(TEST_SESSION)).toBeNull();
    });

    it("shouldTripCircuit returns false when no repetitive use", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        expect(shouldTripCircuit(TEST_SESSION)).toBe(false);
    });

    it("shouldTripCircuit returns true when repetitive use detected", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        expect(shouldTripCircuit(TEST_SESSION)).toBe(true);
    });

    it("shouldTripCircuit returns false after circuit is open", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        shouldTripCircuit(TEST_SESSION);
        expect(shouldTripCircuit(TEST_SESSION)).toBe(false);
    });

    it("isCircuitOpen returns true after circuit trips", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        shouldTripCircuit(TEST_SESSION);
        expect(isCircuitOpen(TEST_SESSION)).toBe(true);
    });

    it("isCircuitOpen returns true until reset timeout", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION, "read");
        shouldTripCircuit(TEST_SESSION);
        
        expect(isCircuitOpen(TEST_SESSION)).toBe(true);
        expect(getCircuitState(TEST_SESSION)?.isOpen).toBe(true);
    });

    it("recordToolCall respects HISTORY_SIZE", () => {
        for (let i = 0; i < 15; i++) {
            recordToolCall(TEST_SESSION, `tool-${i}`);
        }
        const state = getCircuitState(TEST_SESSION);
        expect(state?.toolCallHistory.length).toBeLessThanOrEqual(10);
    });

    it("recordToolCall updates lastAccessedAt", () => {
        const before = getCircuitState(TEST_SESSION);
        
        recordToolCall(TEST_SESSION, "read");
        
        const after = getCircuitState(TEST_SESSION);
        expect(after?.lastAccessedAt).toBeGreaterThanOrEqual(before?.lastAccessedAt ?? 0);
    });

    it("clearCircuitState removes session state", () => {
        recordToolCall(TEST_SESSION, "read");
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
        recordToolCall(TEST_SESSION, "read");
        const state = getCircuitState(TEST_SESSION);
        
        expect(state).toHaveProperty("lastAccessedAt");
        expect(state).toHaveProperty("lastTrippedAt");
        expect(state).toHaveProperty("isOpen");
        expect(state).toHaveProperty("toolCallHistory");
        expect(state?.isOpen).toBe(false);
    });

    it("multiple sessions are isolated", () => {
        for (let i = 0; i < 5; i++) {
            recordToolCall(TEST_SESSION, "read");
        }
        for (let i = 0; i < 5; i++) {
            recordToolCall(TEST_SESSION_2, "edit");
        }
        
        const state1 = getCircuitState(TEST_SESSION);
        const state2 = getCircuitState(TEST_SESSION_2);
        
        expect(state1?.toolCallHistory).not.toEqual(state2?.toolCallHistory);
    });

    it("shutdownCircuitBreaker clears all state", () => {
        recordToolCall(TEST_SESSION, "read");
        recordToolCall(TEST_SESSION_2, "edit");

        shutdownCircuitBreaker();

        expect(getCircuitState(TEST_SESSION)).toBeUndefined();
        expect(getCircuitState(TEST_SESSION_2)).toBeUndefined();
    });
});
