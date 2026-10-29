/**
 * Session activity tracker.
 *
 * Why this exists: `POST /session/{id}/prompt` is NOT a no-op while a session is
 * already running. Upstream `SessionPrompt.prompt` writes the user message and
 * its parts to the session *first*, and only then calls
 * `SessionRunState.ensureRunning`, which — when the session is already in the
 * `Running` state — simply awaits the in-flight run instead of starting a new
 * one. The freshly written message therefore lands in the middle of the turn the
 * model is still executing, and the running loop picks it up on its next step.
 *
 * That is how a well-meant "mission not complete, continue" nudge turns into
 * "the orchestrator keeps interrupting my model mid tool call" (issue #38).
 *
 * The fix is to never inject into a busy session. Busy-ness is tracked from two
 * sources:
 *
 * 1. `session.status` events, which OpenCode publishes on every busy/idle
 *    transition (`SessionStatus.set`). This is the fast, push-based signal.
 * 2. `GET /session/status`, the authoritative map. Upstream deletes a session
 *    from that map the moment it goes idle, so a session is busy exactly when it
 *    appears there with a non-idle status.
 *
 * The remote check is the source of truth. An unavailable status prevents
 * automatic injection until the host can confirm an idle session.
 */

import type { HostClient } from "../../host/client.js";
import { log } from "../agents/logger.js";
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
    lastActivityAt?: number;
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
    const state = applyStatus(sessionID, statusType);
    state.lastActivityAt = state.lastUpdatedAt;
}

function applyStatus(sessionID: string, statusType: string): ActivityState {
    const state = getState(sessionID);
    state.busy = statusType !== SESSION_STATUS.IDLE;
    state.lastStatusType = statusType;
    state.lastUpdatedAt = Date.now();
    return state;
}

/**
 * Note that the host just did something on behalf of this session — a message
 * or part update, a status transition. `session.status` alone is not enough for
 * lifecycle decisions: the run loop reports idle before the last projector
 * writes for the turn have landed, so anything that tears a session down needs
 * to know how recently the host was still writing to it (issue #41).
 */
export function touchSessionActivity(sessionID: string): void {
    if (!sessionID) return;
    const state = getState(sessionID);
    state.lastUpdatedAt = Date.now();
    state.lastActivityAt = state.lastUpdatedAt;
}

/** Epoch ms of the most recent host activity observed for this session, if any. */
export function getLastActivityAt(sessionID: string): number | undefined {
    return activityStates.get(sessionID)?.lastActivityAt;
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
