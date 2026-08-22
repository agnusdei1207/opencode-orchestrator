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
 * The remote check is the source of truth; the event-derived flag is the
 * fallback used when the endpoint is unavailable.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";
import { SESSION_STATUS } from "../../shared/index.js";
import { createPruneTimer } from "../loop/prune-timer.js";

type OpencodeClient = PluginInput["client"];

interface ActivityState {
    busy: boolean;
    /** Last status transition we observed, for diagnostics. */
    lastStatusType: string;
    lastUpdatedAt: number;
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
    }
    return state;
}

/**
 * Record a `session.status` transition. Any status other than `idle` (`busy`,
 * `retry`, …) means the session is still working.
 */
export function recordSessionStatus(sessionID: string, statusType: string | undefined): void {
    if (!sessionID || !statusType) return;
    const state = getState(sessionID);
    state.busy = statusType !== SESSION_STATUS.IDLE;
    state.lastStatusType = statusType;
    state.lastUpdatedAt = Date.now();
}

/** Mark a session busy because we are about to make it work. */
export function markSessionBusy(sessionID: string): void {
    recordSessionStatus(sessionID, SESSION_STATUS.BUSY);
}

/** True when the last observed `session.status` event said the session is working. */
export function isKnownBusy(sessionID: string): boolean {
    return activityStates.get(sessionID)?.busy === true;
}

/**
 * Authoritative busy check. Queries `GET /session/status` and falls back to the
 * event-derived flag when the endpoint is unavailable, so a transport failure
 * degrades to the previous (event-only) behavior rather than deadlocking the
 * mission loop.
 */
export async function isSessionBusy(client: OpencodeClient, sessionID: string): Promise<boolean> {
    if (!sessionID) return false;

    const remote = await readRemoteStatus(client, sessionID);
    if (remote === null) return isKnownBusy(sessionID);

    recordSessionStatus(sessionID, remote);
    return remote !== SESSION_STATUS.IDLE;
}

/**
 * Read this session's status from the server map. Returns `null` when the
 * status could not be determined, and `"idle"` when the session is absent —
 * upstream removes idle sessions from the map entirely.
 */
async function readRemoteStatus(client: OpencodeClient, sessionID: string): Promise<string | null> {
    const statusApi = (client.session as { status?: () => Promise<unknown> }).status;
    if (typeof statusApi !== "function") return null;

    try {
        const response = await statusApi.call(client.session);
        const statuses = readStatusMap(response);
        if (!statuses) return null;

        const entry = statuses[sessionID];
        if (entry === undefined) return SESSION_STATUS.IDLE;
        return readStatusType(entry) ?? SESSION_STATUS.BUSY;
    } catch (error) {
        log("[session-activity] Failed to read session status", { sessionID, error });
        return null;
    }
}

function readStatusMap(response: unknown): Record<string, unknown> | null {
    if (!isRecord(response)) return null;
    const data = response.data ?? response;
    return isRecord(data) ? data : null;
}

function readStatusType(entry: unknown): string | undefined {
    return isRecord(entry) && typeof entry.type === "string" ? entry.type : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
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
