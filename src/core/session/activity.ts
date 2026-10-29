/**
 * Session activity tracker.
 *
 * A prompt sent to a busy session lands inside the turn the model is still
 * running, which interrupts it mid tool call (issue #38). The plugin therefore
 * never injects into a busy session. Busy state comes from the host's
 * execution events: `HostClient.statuses()` holds every non-idle session, and
 * `session.status` updates the local record used by synchronous checks.
 */

import type { HostClient } from "../../host/client.js";
import { log } from "../../shared/logger.js";
import { SESSION_STATUS } from "../../shared/index.js";
import { createPruneTimer } from "../loop/prune-timer.js";

interface ActivityState {
    busy: boolean;
    /** Last status transition we observed, for diagnostics. */
    lastStatusType: string;
    /** Last time this state was written at all; drives TTL pruning. */
    lastUpdatedAt: number;
    /**
     * Last time the host itself did something on this session (a pushed
     * status event, a message or part update). Our own status polls do not
     * count: a poll is us looking, not the host writing.
     */
}

const ACTIVITY_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const activityStates = new Map<string, ActivityState>();

/**
 * A session only gets an explicit release on `session.deleted`, which never
 * arrives if the client goes away or the server restarts. Without this the map
 * grows for the lifetime of the process.
 */
const pruneTimer = createPruneTimer({
    intervalMs: PRUNE_INTERVAL_MS,
    prune: () => pruneSessionActivity(),
});

function getState(sessionID: string): ActivityState {
    let state = activityStates.get(sessionID);
    if (!state) {
        state = { busy: false, lastStatusType: SESSION_STATUS.IDLE, lastUpdatedAt: Date.now() };
        activityStates.set(sessionID, state);
        // Re-arms pruning after shutdown when the host reinitializes the plugin.
        pruneTimer.start();
    }
    return state;
}

/**
 * Record a `session.status` transition. Any status other than `idle` (`busy`,
 * `retry`, …) means the session is still working.
 */
export function recordSessionStatus(sessionID: string, statusType: string | undefined): void {
    if (!sessionID || !statusType) return;
    applyStatus(sessionID, statusType);
}

function applyStatus(sessionID: string, statusType: string): ActivityState {
    const state = getState(sessionID);
    state.busy = statusType !== SESSION_STATUS.IDLE;
    state.lastStatusType = statusType;
    state.lastUpdatedAt = Date.now();
    return state;
}

/** True when the last observed `session.status` event said the session is working. */
export function isKnownBusy(sessionID: string): boolean {
    return activityStates.get(sessionID)?.busy === true;
}

/**
 * Authoritative busy check against the host's event-tracked status map. A
 * session absent from the map is idle: only non-idle sessions are recorded.
 */
export async function isSessionBusy(client: HostClient, sessionID: string): Promise<boolean> {
    if (!sessionID) return false;
    const status = client.statuses().get(sessionID) ?? SESSION_STATUS.IDLE;
    applyStatus(sessionID, status);
    return status !== SESSION_STATUS.IDLE;
}

export function clearSessionActivity(sessionID: string): void {
    activityStates.delete(sessionID);
}

/** Drop states for sessions we have not heard from in a while. */
export function pruneSessionActivity(now: number = Date.now()): void {
    for (const [sessionID, state] of activityStates.entries()) {
        if (now - state.lastUpdatedAt > ACTIVITY_TTL_MS) {
            activityStates.delete(sessionID);
            log("[session-activity] Pruned stale state", { sessionID });
        }
    }
}

/** Stop the prune timer and drop all state, for plugin shutdown. */
export function shutdownSessionActivity(): void {
    pruneTimer.shutdown();
    activityStates.clear();
}

/** Test seam: forget every tracked session. */
export function resetSessionActivity(): void {
    activityStates.clear();
}

pruneTimer.start();
