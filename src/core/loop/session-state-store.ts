/**
 * Session State Store - TTL-based Session State Management
 * 
 * Provides automatic cleanup of stale session states to prevent memory leaks.
 */

import { log } from "../agents/logger.js";

export interface SessionState {
    stagnationCount: number;
    countdownTimer?: ReturnType<typeof setTimeout>;
    countdownStartedAt?: number;
    lastCheckTime?: number;
    isRecovering: boolean;
    isAborting: boolean;
    inFlight: boolean;
}

interface TrackedSession {
    state: SessionState;
    lastAccessedAt: number;
}

export const SESSION_STATE_TTL_MS = 10 * 60 * 1000;
export const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

type TimerHandle = ReturnType<typeof setInterval>;

export interface SessionStateStore {
    getState: (sessionID: string) => SessionState;
    getExistingState: (sessionID: string) => SessionState | undefined;
    cancelCountdown: (sessionID: string) => void;
    cleanup: (sessionID: string) => void;
    cancelAllCountdowns: () => void;
    shutdown: () => void;
}

function createSessionStateStore(): SessionStateStore {
    const sessions = new Map<string, TrackedSession>();

    let pruneInterval: TimerHandle | undefined;
    pruneInterval = setInterval(() => {
        const now = Date.now();
        for (const [sessionID, tracked] of sessions.entries()) {
            if (now - tracked.lastAccessedAt > SESSION_STATE_TTL_MS) {
                cancelCountdownInternal(tracked.state);
                sessions.delete(sessionID);
                log(`[session-state-store] Pruned stale session`, { sessionID });
            }
        }
    }, PRUNE_INTERVAL_MS);

    if (typeof pruneInterval === "object" && typeof pruneInterval.unref === "function") {
        pruneInterval.unref();
    }

    function getTrackedSession(sessionID: string): TrackedSession {
        const existing = sessions.get(sessionID);
        if (existing) {
            existing.lastAccessedAt = Date.now();
            return existing;
        }

        const rawState: SessionState = {
            stagnationCount: 0,
            isRecovering: false,
            isAborting: false,
            inFlight: false,
        };
        const trackedSession: TrackedSession = {
            state: rawState,
            lastAccessedAt: Date.now(),
        };
        sessions.set(sessionID, trackedSession);
        return trackedSession;
    }

    function getState(sessionID: string): SessionState {
        return getTrackedSession(sessionID).state;
    }

    function getExistingState(sessionID: string): SessionState | undefined {
        const existing = sessions.get(sessionID);
        if (existing) {
            existing.lastAccessedAt = Date.now();
            return existing.state;
        }
        return undefined;
    }

    function cancelCountdownInternal(state: SessionState): void {
        if (state.countdownTimer) {
            clearTimeout(state.countdownTimer);
            state.countdownTimer = undefined;
        }
        state.countdownStartedAt = undefined;
        state.inFlight = false;
    }

    function cancelCountdown(sessionID: string): void {
        const tracked = sessions.get(sessionID);
        if (!tracked) return;
        cancelCountdownInternal(tracked.state);
    }

    function cleanup(sessionID: string): void {
        const tracked = sessions.get(sessionID);
        if (!tracked) return;
        cancelCountdownInternal(tracked.state);
        sessions.delete(sessionID);
    }

    function cancelAllCountdowns(): void {
        for (const tracked of sessions.values()) {
            cancelCountdownInternal(tracked.state);
        }
    }

    function shutdown(): void {
        if (pruneInterval !== undefined) {
            clearInterval(pruneInterval);
        }
        cancelAllCountdowns();
        sessions.clear();
    }

    return {
        getState,
        getExistingState,
        cancelCountdown,
        cleanup,
        cancelAllCountdowns,
        shutdown,
    };
}

export { createSessionStateStore };
