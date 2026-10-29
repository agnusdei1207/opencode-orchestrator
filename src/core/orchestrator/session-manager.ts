import { log } from "../../shared/logger.js";
import { readLoopState } from "../loop/mission-loop.js";
import type { PluginSessionState } from "../../plugin-handlers/context.js";

/**
 * Return the session's state, creating it on first use. A session that owns
 * the persisted mission resumes its step count and start time, so they
 * survive a plugin reload.
 */
export function ensureSessionInitialized(
    sessions: Map<string, PluginSessionState>,
    sessionID: string,
    directory?: string,
): PluginSessionState {
    const existing = sessions.get(sessionID);
    if (existing) return existing;

    const now = Date.now();
    const session: PluginSessionState = {
        active: true,
        step: 0,
        startTime: now,
        lastStepTime: now,
        tokens: { totalInput: 0, totalOutput: 0 },
    };
    const mission = directory ? readLoopState(directory) : null;
    if (mission?.sessionID === sessionID) {
        session.step = mission.iteration;
        session.startTime = new Date(mission.startedAt).getTime();
        log(`[SessionManager] Rehydrated session from disk: ${sessionID}`);
    }
    sessions.set(sessionID, session);
    return session;
}
