/**
 * Session State Store - TTL-based Session State Management
 * 
 * Provides automatic cleanup of stale session states to prevent memory leaks.
 */

import { log } from "../agents/logger.js";
import { createPruneTimer } from "./prune-timer.js";

export interface SessionState {
    countdownTimer?: ReturnType<typeof setTimeout>;
    countdownStartedAt?: number;
    lastCheckTime?: number;
    isAborting: boolean;
}

interface TrackedSession {
    state: SessionState;
    lastAccessedAt: number;
}

export const SESSION_STATE_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

interface SessionStateStore {
    getState: (sessionID: string) => SessionState;
    getExistingState: (sessionID: string) => SessionState | undefined;
    cancelCountdown: (sessionID: string) => void;
    cleanup: (sessionID: string) => void;
    cancelAllCountdowns: () => void;
    shutdown: () => void;
}

class InMemorySessionStateStore implements SessionStateStore {
    private readonly sessions = new Map<string, TrackedSession>();
    private readonly pruneTimer = createPruneTimer({
        intervalMs: PRUNE_INTERVAL_MS,
        prune: () => this.prune(),
    });

    constructor() {
        this.pruneTimer.start();
    }

    private prune(): void {
        const now = Date.now();
        for (const [sessionID, tracked] of this.sessions.entries()) {
            if (now - tracked.lastAccessedAt <= SESSION_STATE_TTL_MS) continue;
            this.cancelCountdownInternal(tracked.state);
            this.sessions.delete(sessionID);
            log(`[session-state-store] Pruned stale session`, { sessionID });
        }
    }

    private getTrackedSession(sessionID: string): TrackedSession {
        const existing = this.sessions.get(sessionID);
        if (existing) {
            existing.lastAccessedAt = Date.now();
            return existing;
        }

        const rawState: SessionState = {
            isAborting: false,
        };
        const trackedSession: TrackedSession = {
            state: rawState,
            lastAccessedAt: Date.now(),
        };
        this.sessions.set(sessionID, trackedSession);
        return trackedSession;
    }

    getState(sessionID: string): SessionState {
        return this.getTrackedSession(sessionID).state;
    }

    getExistingState(sessionID: string): SessionState | undefined {
        const existing = this.sessions.get(sessionID);
        if (existing) {
            existing.lastAccessedAt = Date.now();
            return existing.state;
        }
        return undefined;
    }

    private cancelCountdownInternal(state: SessionState): void {
        if (state.countdownTimer) {
            clearTimeout(state.countdownTimer);
            state.countdownTimer = undefined;
        }
        state.countdownStartedAt = undefined;
    }

    cancelCountdown(sessionID: string): void {
        const tracked = this.sessions.get(sessionID);
        if (!tracked) return;
        this.cancelCountdownInternal(tracked.state);
    }

    cleanup(sessionID: string): void {
        const tracked = this.sessions.get(sessionID);
        if (!tracked) return;
        this.cancelCountdownInternal(tracked.state);
        this.sessions.delete(sessionID);
    }

    cancelAllCountdowns(): void {
        for (const tracked of this.sessions.values()) {
            this.cancelCountdownInternal(tracked.state);
        }
    }

    shutdown(): void {
        this.pruneTimer.shutdown();
        this.cancelAllCountdowns();
        this.sessions.clear();
    }
}

function createSessionStateStore(): SessionStateStore {
    return new InMemorySessionStateStore();
}

export { createSessionStateStore };
