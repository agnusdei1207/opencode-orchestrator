import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
        
        expect(state.isAborting).toBe(false);
        expect(state.countdownTimer).toBeUndefined();
        expect(state.countdownStartedAt).toBeUndefined();
    });

    it("returns existing state on subsequent calls", () => {
        const state1 = store.getState(TEST_SESSION);
        state1.isAborting = true;
        
        const state2 = store.getState(TEST_SESSION);
        expect(state2.isAborting).toBe(true);
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
        expect(state!.isAborting).toBe(false);
    });

    it("cancelCountdown clears countdown timer", () => {
        const state = store.getState(TEST_SESSION);
        state.countdownTimer = setTimeout(() => {}, 1000) as any;
        state.countdownStartedAt = Date.now();

        store.cancelCountdown(TEST_SESSION);

        expect(state.countdownTimer).toBeUndefined();
        expect(state.countdownStartedAt).toBeUndefined();
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

        const state2 = store.getState(TEST_SESSION_2);
        state2.countdownTimer = setTimeout(() => {}, 1000) as any;

        store.cancelAllCountdowns();

        expect(state1.countdownTimer).toBeUndefined();
        expect(state2.countdownTimer).toBeUndefined();
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

        state1.lastCheckTime = 5;
        state2.isAborting = true;

        expect(store.getState(TEST_SESSION).lastCheckTime).toBe(5);
        expect(store.getState(TEST_SESSION).isAborting).toBe(false);
        expect(store.getState(TEST_SESSION_2).isAborting).toBe(true);
    });

    // The prune sweep runs every 2 minutes and drops sessions idle longer than
    // the TTL. Touching a session halfway through must push its expiry out.
    const HALF_TTL_MS = SESSION_STATE_TTL_MS / 2;
    const PRUNE_SWEEP_MS = 2 * 60 * 1000;

    function withFakeClock(run: (fakeStore: ReturnType<typeof createSessionStateStore>) => void): void {
        vi.useFakeTimers();
        const fakeStore = createSessionStateStore();
        try {
            run(fakeStore);
        } finally {
            fakeStore.shutdown();
            vi.useRealTimers();
        }
    }

    it("lastAccessedAt is updated on getState", () => {
        withFakeClock(fakeStore => {
            const original = fakeStore.getState(TEST_SESSION);
            vi.advanceTimersByTime(HALF_TTL_MS);
            const before = Date.now();
            fakeStore.getState(TEST_SESSION);

            // Past the original expiry, but within the TTL of the refreshed access.
            vi.advanceTimersByTime(HALF_TTL_MS + PRUNE_SWEEP_MS);
            const after = Date.now();
            expect(after - before).toBeLessThanOrEqual(SESSION_STATE_TTL_MS);
            expect(fakeStore.getExistingState(TEST_SESSION)).toBe(original);

            // Left idle beyond the TTL, the session is pruned.
            vi.advanceTimersByTime(SESSION_STATE_TTL_MS + PRUNE_SWEEP_MS);
            expect(fakeStore.getExistingState(TEST_SESSION)).toBeUndefined();
        });
    });

    it("lastAccessedAt is updated on getExistingState", () => {
        withFakeClock(fakeStore => {
            const original = fakeStore.getState(TEST_SESSION);
            vi.advanceTimersByTime(HALF_TTL_MS);
            expect(fakeStore.getExistingState(TEST_SESSION)).toBe(original);

            vi.advanceTimersByTime(HALF_TTL_MS + PRUNE_SWEEP_MS);
            expect(fakeStore.getExistingState(TEST_SESSION)).toBe(original);

            vi.advanceTimersByTime(SESSION_STATE_TTL_MS + PRUNE_SWEEP_MS);
            expect(fakeStore.getExistingState(TEST_SESSION)).toBeUndefined();
        });
    });
});
