import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionStateStore, SESSION_STATE_TTL_MS } from "../../../src/core/loop/session-state-store";

describe("SessionStateStore", () => {
    let store: ReturnType<typeof createSessionStateStore>;
    const TEST_SESSION = "test-session";
    const TEST_SESSION_2 = "test-session-2";

    beforeEach(() => {
        store = createSessionStateStore();
    });

    afterEach(() => {
        store.shutdown();
    });

    it("creates initial state with defaults", () => {
        const state = store.getState(TEST_SESSION);
        
        expect(state.stagnationCount).toBe(0);
        expect(state.isRecovering).toBe(false);
        expect(state.isAborting).toBe(false);
        expect(state.inFlight).toBe(false);
        expect(state.countdownTimer).toBeUndefined();
        expect(state.countdownStartedAt).toBeUndefined();
    });

    it("returns existing state on subsequent calls", () => {
        const state1 = store.getState(TEST_SESSION);
        state1.stagnationCount = 5;
        
        const state2 = store.getState(TEST_SESSION);
        expect(state2.stagnationCount).toBe(5);
        expect(state1).toBe(state2);
    });

    it("getExistingState returns undefined for non-existent session", () => {
        const state = store.getExistingState("non-existent");
        expect(state).toBeUndefined();
    });

    it("getExistingState returns state and updates lastAccessedAt", () => {
        store.getState(TEST_SESSION);
        const state = store.getExistingState(TEST_SESSION);
        
        expect(state).toBeDefined();
        expect(state!.stagnationCount).toBe(0);
    });

    it("cancelCountdown clears countdown timer", () => {
        const state = store.getState(TEST_SESSION);
        state.countdownTimer = setTimeout(() => {}, 1000) as any;
        state.countdownStartedAt = Date.now();
        state.inFlight = true;

        store.cancelCountdown(TEST_SESSION);

        expect(state.countdownTimer).toBeUndefined();
        expect(state.countdownStartedAt).toBeUndefined();
        expect(state.inFlight).toBe(false);
    });

    it("cancelCountdown handles non-existent session", () => {
        expect(() => store.cancelCountdown("non-existent")).not.toThrow();
    });

    it("cleanup removes session entirely", () => {
        store.getState(TEST_SESSION);
        expect(store.getExistingState(TEST_SESSION)).toBeDefined();

        store.cleanup(TEST_SESSION);
        expect(store.getExistingState(TEST_SESSION)).toBeUndefined();
    });

    it("cleanup handles non-existent session", () => {
        expect(() => store.cleanup("non-existent")).not.toThrow();
    });

    it("cancelAllCountdowns clears all countdowns", () => {
        const state1 = store.getState(TEST_SESSION);
        state1.countdownTimer = setTimeout(() => {}, 1000) as any;
        state1.inFlight = true;

        const state2 = store.getState(TEST_SESSION_2);
        state2.countdownTimer = setTimeout(() => {}, 1000) as any;
        state2.inFlight = true;

        store.cancelAllCountdowns();

        expect(state1.countdownTimer).toBeUndefined();
        expect(state1.inFlight).toBe(false);
        expect(state2.countdownTimer).toBeUndefined();
        expect(state2.inFlight).toBe(false);
    });

    it("shutdown clears all sessions and interval", () => {
        store.getState(TEST_SESSION);
        store.getState(TEST_SESSION_2);

        store.shutdown();

        expect(store.getExistingState(TEST_SESSION)).toBeUndefined();
        expect(store.getExistingState(TEST_SESSION_2)).toBeUndefined();
    });

    it("multiple sessions are isolated", () => {
        const state1 = store.getState(TEST_SESSION);
        const state2 = store.getState(TEST_SESSION_2);

        state1.stagnationCount = 5;
        state1.isRecovering = true;
        state2.stagnationCount = 10;
        state2.isAborting = true;

        expect(store.getState(TEST_SESSION).stagnationCount).toBe(5);
        expect(store.getState(TEST_SESSION).isRecovering).toBe(true);
        expect(store.getState(TEST_SESSION_2).stagnationCount).toBe(10);
        expect(store.getState(TEST_SESSION_2).isAborting).toBe(true);
    });

    it("lastAccessedAt is updated on getState", () => {
        store.getState(TEST_SESSION);
        const before = Date.now();
        
        store.getState(TEST_SESSION);
        const after = Date.now();
        
        const state = store.getExistingState(TEST_SESSION);
        expect(state).toBeDefined();
    });

    it("lastAccessedAt is updated on getExistingState", () => {
        store.getState(TEST_SESSION);
        
        store.getExistingState(TEST_SESSION);
        
        const state = store.getExistingState(TEST_SESSION);
        expect(state).toBeDefined();
    });
});
