import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    armCompactionGuard,
    isCompactionSafe,
    clearCompactionState,
    getCompactionState,
    shutdownCompactionGuard,
} from "../../../src/core/loop/compaction-guard";

describe("CompactionGuard", () => {
    const TEST_SESSION = "test-session-compaction";
    const TEST_SESSION_2 = "test-session-2";

    beforeEach(() => {
        clearCompactionState(TEST_SESSION);
        clearCompactionState(TEST_SESSION_2);
    });

    afterEach(() => {
        clearCompactionState(TEST_SESSION);
        clearCompactionState(TEST_SESSION_2);
        shutdownCompactionGuard();
    });

    it("armCompactionGuard returns the timestamp as epoch", () => {
        const epoch = armCompactionGuard(TEST_SESSION, 1000);
        expect(epoch).toBe(1000);
    });

    it("isCompactionSafe returns true when no state exists", () => {
        const safe = isCompactionSafe(TEST_SESSION, 1000);
        expect(safe).toBe(true);
    });

    it("isCompactionSafe returns true when currentEpoch equals saved epoch", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        const safe = isCompactionSafe(TEST_SESSION, 1000);
        expect(safe).toBe(true);
    });

    it("isCompactionSafe returns false when currentEpoch is newer", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        const safe = isCompactionSafe(TEST_SESSION, 2000);
        expect(safe).toBe(false);
    });

    it("isCompactionSafe returns true when currentEpoch is older", () => {
        armCompactionGuard(TEST_SESSION, 2000);
        const safe = isCompactionSafe(TEST_SESSION, 1000);
        expect(safe).toBe(true);
    });

    it("armCompactionGuard updates existing epoch", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        armCompactionGuard(TEST_SESSION, 2000);
        
        const state = getCompactionState(TEST_SESSION);
        expect(state?.compactionEpoch).toBe(2000);
    });

    it("clearCompactionState removes session state", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        expect(getCompactionState(TEST_SESSION)).toBeDefined();

        clearCompactionState(TEST_SESSION);
        expect(getCompactionState(TEST_SESSION)).toBeUndefined();
    });

    it("clearCompactionState handles non-existent session", () => {
        expect(() => clearCompactionState("non-existent")).not.toThrow();
    });

    it("getCompactionState returns undefined for non-existent session", () => {
        expect(getCompactionState("non-existent")).toBeUndefined();
    });

    it("multiple sessions are isolated", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        armCompactionGuard(TEST_SESSION_2, 2000);

        expect(isCompactionSafe(TEST_SESSION, 1000)).toBe(true);
        expect(isCompactionSafe(TEST_SESSION, 2000)).toBe(false);
        expect(isCompactionSafe(TEST_SESSION_2, 1000)).toBe(true);
        expect(isCompactionSafe(TEST_SESSION_2, 2000)).toBe(true);
    });

    it("shutdownCompactionGuard clears all state", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        armCompactionGuard(TEST_SESSION_2, 2000);

        shutdownCompactionGuard();

        expect(getCompactionState(TEST_SESSION)).toBeUndefined();
        expect(getCompactionState(TEST_SESSION_2)).toBeUndefined();
    });

    it("isCompactionSafe allows continuation after re-arm with newer epoch", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        expect(isCompactionSafe(TEST_SESSION, 2000)).toBe(false);

        armCompactionGuard(TEST_SESSION, 2000);
        expect(isCompactionSafe(TEST_SESSION, 2000)).toBe(true);
        expect(isCompactionSafe(TEST_SESSION, 3000)).toBe(false);
    });

    it("returns correct state shape", () => {
        armCompactionGuard(TEST_SESSION, 1000);
        const state = getCompactionState(TEST_SESSION);
        
        expect(state).toHaveProperty("compactionEpoch");
        expect(state).toHaveProperty("lastAccessedAt");
        expect(state!.compactionEpoch).toBe(1000);
    });
});
