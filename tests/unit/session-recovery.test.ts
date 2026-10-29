import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    cleanupSessionRecovery,
    handleSessionError,
    markRecoveryComplete,
} from "../../src/core/recovery/session-recovery";
import { detectErrorType, ERROR_TYPE, RECOVERY } from "../../src/shared";
import * as SessionActivity from "../../src/core/session/activity";
import { clearPrompts, peekPrompts } from "../../src/core/session/pending-injection";

vi.mock("../../src/shared/logger", () => ({ log: vi.fn() }));

const touchedSessions: string[] = [];
let mockClient: {
    prompt: ReturnType<typeof vi.fn>;
    statuses: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
    mockClient = {
        prompt: vi.fn().mockResolvedValue(undefined),
        statuses: vi.fn(() => new Map()),
    };
});

afterEach(() => {
    for (const sessionID of touchedSessions.splice(0)) {
        cleanupSessionRecovery(sessionID);
    }
    vi.clearAllMocks();
    vi.useRealTimers();
});

it("detects recovery-supported error types using the shared detector", () => {
    expect(detectErrorType("tool_result_missing")).toBe(ERROR_TYPE.TOOL_RESULT_MISSING);
    expect(detectErrorType("429 Too Many Requests")).toBe(ERROR_TYPE.RATE_LIMIT);
    expect(detectErrorType("thinking_block_order")).toBe(ERROR_TYPE.THINKING_BLOCK_ORDER);
    expect(detectErrorType("random error message")).toBeNull();
});

it("injects a compact tool-crash recovery prompt through the host client", async () => {
    vi.useFakeTimers();
    const sessionID = "session-recovery-tool";
    touchedSessions.push(sessionID);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("tool_result_missing"),
    );

    expect(recovered).toBe(true);
    expect(mockClient.prompt).toHaveBeenCalledWith({
        sessionID,
        text: expect.stringContaining('<recovery type="tool_crash">'),
    });

    // The reentrancy guard is released once recovery finishes: after the
    // cooldown a later recoverable error is handled again.
    vi.advanceTimersByTime(RECOVERY.RETRY_COOLDOWN_MS);
    expect(await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("tool_result_missing"),
    )).toBe(true);
    expect(mockClient.prompt).toHaveBeenCalledTimes(2);
});

it("injects thinking block recovery prompt for thinking errors", async () => {
    const sessionID = "session-recovery-thinking";
    touchedSessions.push(sessionID);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("thinking_block_order"),
    );

    expect(recovered).toBe(true);
    expect(mockClient.prompt).toHaveBeenCalledWith({
        sessionID,
        text: expect.stringContaining('<recovery type="thinking_block">'),
    });
});

it("queues recovery notice when session is currently busy", async () => {
    const sessionID = "session-recovery-busy";
    touchedSessions.push(sessionID);

    const busySpy = vi.spyOn(SessionActivity, "isSessionBusy").mockResolvedValue(true);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("tool_result_missing"),
    );

    expect(recovered).toBe(true);
    // Prompt was not immediately dispatched
    expect(mockClient.prompt).not.toHaveBeenCalled();
    expect(peekPrompts(sessionID)).toEqual([expect.stringContaining('<recovery type="tool_crash">')]);

    busySpy.mockRestore();
    clearPrompts(sessionID);
});

it("does not recover rate limit errors, which the host retries itself", async () => {
    const sessionID = "session-recovery-rate-limit";
    touchedSessions.push(sessionID);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("429 rate limit exceeded"),
    );

    expect(recovered).toBe(false);
    expect(mockClient.prompt).not.toHaveBeenCalled();
});

it("returns false without recovery for user aborted messages", async () => {
    const sessionID = "session-recovery-abort";
    touchedSessions.push(sessionID);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("User cancelled message"),
    );

    expect(recovered).toBe(false);
    expect(mockClient.prompt).not.toHaveBeenCalled();
});

it("returns false without recovery for context overflow", async () => {
    const sessionID = "session-recovery-overflow";
    touchedSessions.push(sessionID);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("context length exceeded token limit"),
    );

    expect(recovered).toBe(false);
});

it("does not inject a recovery prompt for unknown errors", async () => {
    const sessionID = "session-recovery-unknown";
    touchedSessions.push(sessionID);

    const recovered = await handleSessionError(
        mockClient as unknown as Parameters<typeof handleSessionError>[0],
        sessionID,
        new Error("unmatched failure"),
    );

    expect(recovered).toBe(false);
    expect(mockClient.prompt).not.toHaveBeenCalled();
});

it("does not let an unknown error start the cooldown for a recoverable one", async () => {
    const sessionID = "session-recovery-unknown-then-tool";
    touchedSessions.push(sessionID);
    const client = mockClient as unknown as Parameters<typeof handleSessionError>[0];

    expect(await handleSessionError(client, sessionID, new Error("unmatched failure"))).toBe(false);
    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(true);
});

it("does not spend the recovery attempt budget on unknown errors", async () => {
    vi.useFakeTimers();
    const sessionID = "session-recovery-unknown-budget";
    touchedSessions.push(sessionID);
    const client = mockClient as unknown as Parameters<typeof handleSessionError>[0];

    for (let attempt = 0; attempt <= RECOVERY.MAX_ATTEMPTS; attempt++) {
        await handleSessionError(client, sessionID, new Error("unmatched failure"));
        vi.advanceTimersByTime(RECOVERY.RETRY_COOLDOWN_MS);
    }

    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(true);
});

it("cleanup forgets the cooldown so a new error is recovered immediately", async () => {
    const sessionID = "session-recovery-cleanup";
    touchedSessions.push(sessionID);
    const client = mockClient as unknown as Parameters<typeof handleSessionError>[0];

    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(true);
    // Still inside the cooldown window.
    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(false);

    cleanupSessionRecovery(sessionID);
    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(true);
});

it("a completed assistant message resets the attempt budget", async () => {
    vi.useFakeTimers();
    const sessionID = "session-recovery-budget-reset";
    touchedSessions.push(sessionID);
    const client = mockClient as unknown as Parameters<typeof handleSessionError>[0];

    for (let attempt = 0; attempt < RECOVERY.MAX_ATTEMPTS; attempt++) {
        expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(true);
        vi.advanceTimersByTime(RECOVERY.RETRY_COOLDOWN_MS);
    }
    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(false);
    vi.advanceTimersByTime(RECOVERY.RETRY_COOLDOWN_MS);

    expect(() => markRecoveryComplete(sessionID)).not.toThrow();
    expect(await handleSessionError(client, sessionID, new Error("tool_result_missing"))).toBe(true);
});

it("markRecoveryComplete and cleanup tolerate unknown sessions", () => {
    expect(() => markRecoveryComplete("never-seen")).not.toThrow();
    expect(() => cleanupSessionRecovery("never-seen")).not.toThrow();
});
