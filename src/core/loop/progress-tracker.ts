/**
 * Progress Tracker - counts mission checks that made no progress.
 *
 * Progress means the number of remaining verification items went down. A check
 * only counts as stagnant after a continuation was injected, so the model had
 * a chance to act. The count drives the stagnation intervention (at
 * DEFAULT_STAGNATION_THRESHOLD) and the escalation in the continuation prompt.
 */

import { createPruneTimer } from "./prune-timer.js";

interface TrackerState {
    stagnationCount: number;
    lastIncompleteCount?: number;
    awaitingPostInjectionProgressCheck: boolean;
    lastAccessedAt: number;
}

export const DEFAULT_STAGNATION_THRESHOLD = 3;

const TRACKER_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const sessionStates = new Map<string, TrackerState>();

const pruneTimer = createPruneTimer({
    intervalMs: PRUNE_INTERVAL_MS,
    prune: () => {
        const now = Date.now();
        for (const [sessionID, state] of sessionStates.entries()) {
            if (now - state.lastAccessedAt > TRACKER_TTL_MS) sessionStates.delete(sessionID);
        }
    },
});

function getState(sessionID: string): TrackerState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = { stagnationCount: 0, awaitingPostInjectionProgressCheck: false, lastAccessedAt: Date.now() };
        sessionStates.set(sessionID, state);
        // Re-arms pruning after shutdown when the host reinitializes the plugin.
        pruneTimer.start();
    }
    state.lastAccessedAt = Date.now();
    return state;
}

/** Record the remaining item count and return the current stagnation count. */
export function trackProgress(sessionID: string, incompleteCount: number): number {
    const state = getState(sessionID);
    const previous = state.lastIncompleteCount;
    state.lastIncompleteCount = incompleteCount;
    if (previous === undefined || incompleteCount < previous) {
        state.stagnationCount = 0;
        state.awaitingPostInjectionProgressCheck = false;
    } else if (state.awaitingPostInjectionProgressCheck) {
        state.stagnationCount += 1;
    }
    return state.stagnationCount;
}

export function markInjectionPerformed(sessionID: string): void {
    getState(sessionID).awaitingPostInjectionProgressCheck = true;
}

export function clearSession(sessionID: string): void {
    sessionStates.delete(sessionID);
}

/** Stop the prune timer and drop all state, for plugin shutdown. */
export function shutdownProgressTracker(): void {
    pruneTimer.shutdown();
    sessionStates.clear();
}

pruneTimer.start();
