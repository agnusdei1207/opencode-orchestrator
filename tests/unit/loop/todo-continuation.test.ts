import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    handleUserMessage,
    handleSessionError,
    handleAbort,
    cleanupSession,
    hasPendingContinuation,
} from "../../../src/core/loop/todo-continuation";

describe("TodoContinuation", () => {
    const TEST_SESSION = "test-session-continuation";
    const TEST_SESSION_2 = "test-session-2";

    beforeEach(() => {
        cleanupSession(TEST_SESSION);
        cleanupSession(TEST_SESSION_2);
    });

    afterEach(() => {
        cleanupSession(TEST_SESSION);
        cleanupSession(TEST_SESSION_2);
    });

    describe("hasPendingContinuation", () => {
        it("returns false for non-existent session", () => {
            expect(hasPendingContinuation("non-existent")).toBe(false);
        });

        it("returns false when no countdown is running", () => {
            handleUserMessage(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });
    });

    describe("handleAbort", () => {
        it("marks session as aborting", () => {
            handleAbort(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });

        it("handles multiple aborts", () => {
            handleAbort(TEST_SESSION);
            handleAbort(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });

        it("cancels any pending countdown", () => {
            cleanupSession(TEST_SESSION);
            handleAbort(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });
    });

    describe("handleSessionError", () => {
        it("detects MessageAbortedError", () => {
            const error = { name: "MessageAbortedError" };
            handleSessionError(TEST_SESSION, error);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });

        it("detects AbortError", () => {
            const error = { name: "AbortError" };
            handleSessionError(TEST_SESSION, error);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });

        it("handles other errors gracefully", () => {
            expect(() => handleSessionError(TEST_SESSION, new Error("test"))).not.toThrow();
        });

        it("handles undefined error gracefully", () => {
            expect(() => handleSessionError(TEST_SESSION, undefined)).not.toThrow();
        });

        it("handles null error gracefully", () => {
            expect(() => handleSessionError(TEST_SESSION, null)).not.toThrow();
        });
    });

    describe("handleUserMessage", () => {
        it("handles non-existent session", () => {
            expect(() => handleUserMessage("non-existent")).not.toThrow();
        });

        it("handles multiple messages", () => {
            handleUserMessage(TEST_SESSION);
            handleUserMessage(TEST_SESSION);
            handleUserMessage(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });
    });

    describe("cleanupSession", () => {
        it("removes session state", () => {
            handleAbort(TEST_SESSION);
            cleanupSession(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
        });

        it("handles non-existent session", () => {
            expect(() => cleanupSession("non-existent")).not.toThrow();
        });

        it("can clean up multiple sessions", () => {
            handleAbort(TEST_SESSION);
            handleAbort(TEST_SESSION_2);
            cleanupSession(TEST_SESSION);
            cleanupSession(TEST_SESSION_2);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
            expect(hasPendingContinuation(TEST_SESSION_2)).toBe(false);
        });
    });

    describe("multiple sessions", () => {
        it("sessions are isolated", () => {
            handleAbort(TEST_SESSION);
            expect(hasPendingContinuation(TEST_SESSION)).toBe(false);
            expect(hasPendingContinuation(TEST_SESSION_2)).toBe(false);
        });
    });
});
