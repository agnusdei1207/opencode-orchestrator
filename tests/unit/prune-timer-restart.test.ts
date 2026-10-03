/**
 * OpenCode reloads an instance by running its disposers (the plugin's
 * dispose → shutdown*()) and then initializing the plugin again in the same
 * process, where these modules stay cached. Pruning must resume on next use.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCircuitState, recordToolCall, shutdownCircuitBreaker } from "../../src/core/loop/circuit-breaker";
import { armCompactionGuard, getCompactionState, shutdownCompactionGuard } from "../../src/core/loop/compaction-guard";
import { shutdownProgressTracker, trackProgress } from "../../src/core/loop/progress-tracker";
import { createSessionStateStore } from "../../src/core/loop/session-state-store";
import { isKnownBusy, recordSessionStatus, shutdownSessionActivity } from "../../src/core/session/activity";
import { hasPendingPrompts, queueNotice, shutdownPendingInjections } from "../../src/core/session/pending-injection";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

/** Longer than every module's TTL plus one prune interval. */
const PAST_EVERY_TTL_MS = 60 * 60 * 1000;
const SESSION_ID = "reloaded-session";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    // Drop intervals created under fake timers so no module keeps a fake handle.
    shutdownCircuitBreaker();
    shutdownCompactionGuard();
    shutdownProgressTracker();
    shutdownSessionActivity();
    shutdownPendingInjections();
    vi.useRealTimers();
});

const cases: Array<[string, () => void, () => boolean]> = [
    ["circuit breaker", () => {
        shutdownCircuitBreaker();
        recordToolCall(SESSION_ID, "read");
    }, () => getCircuitState(SESSION_ID) !== undefined],
    ["compaction guard", () => {
        shutdownCompactionGuard();
        armCompactionGuard(SESSION_ID, Date.now());
    }, () => getCompactionState(SESSION_ID) !== undefined],
    ["progress tracker", () => {
        shutdownProgressTracker();
        trackProgress(SESSION_ID, 3);
    }, () => trackProgress(SESSION_ID, 3).previousIncompleteCount !== undefined],
    ["session activity", () => {
        shutdownSessionActivity();
        recordSessionStatus(SESSION_ID, "busy");
    }, () => isKnownBusy(SESSION_ID)],
    ["pending injection", () => {
        shutdownPendingInjections();
        queueNotice(SESSION_ID, "background task finished");
    }, () => hasPendingPrompts(SESSION_ID)],
];

it.each(cases)("%s resumes pruning after shutdown", (_name, shutdownThenUse, isRetained) => {
    shutdownThenUse();
    expect(isRetained()).toBe(true);

    vi.advanceTimersByTime(PAST_EVERY_TTL_MS);

    expect(isRetained()).toBe(false);
});

it("mission loop session state store resumes pruning after shutdown", () => {
    const store = createSessionStateStore();
    store.shutdown();
    store.getState(SESSION_ID).isAborting = true;

    vi.advanceTimersByTime(PAST_EVERY_TTL_MS);

    expect(store.getExistingState(SESSION_ID)).toBeUndefined();
    store.shutdown();
});
