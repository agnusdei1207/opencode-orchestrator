import { state } from "./state.js";
import { log } from "../agents/logger.js";
import { SessionState } from "./interfaces/session-state.js";

/**
 * Session Manager
 * 
 * Centralizes all direct access to the global `state` and session initialization logic.
 * Eliminates redundant state checks across hooks and handlers.
 */

/**
 * Ensures a local session object exists in the plugin context map.
 * This is "Session State 1" (Plugin-local tracking).
 */
export function ensureSessionInitialized(
    sessions: Map<string, any>,
    sessionID: string
): any {
    if (!sessions.has(sessionID)) {
        const now = Date.now();
        const newSession = {
            active: true,
            step: 0,
            timestamp: now,
            startTime: now,
            lastStepTime: now,
            tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
        };
        sessions.set(sessionID, newSession);
        // log(`[SessionManager] Initialized local session: ${sessionID}`);
    }
    return sessions.get(sessionID);
}

/**
 * Ensures a global mission state exists for a specific session.
 */
function ensureGlobalState(sessionID: string): SessionState {
    let stateSession = state.sessions.get(sessionID);

    if (!stateSession) {
        const newState: SessionState = {
            enabled: true,
            iterations: 0,
            taskRetries: new Map(),
            currentTask: "",
            anomalyCount: 0,
        };
        state.sessions.set(sessionID, newState);
        return newState;
    }
    return stateSession;
}

/**
 * Activates the global mission state for a specific session.
 */
export function activateMissionState(sessionID: string): void {
    const stateSession = ensureGlobalState(sessionID);
    stateSession.enabled = true;
    stateSession.anomalyCount = 0;
    state.missionActive = true;
    log(`[SessionManager] Mission Activated: ${sessionID}`);
}

/**
 * Checks if the mission is globally active and the session is enabled.
 */
export function isMissionActive(sessionID: string): boolean {
    const stateSession = state.sessions.get(sessionID);
    return !!(state.missionActive && stateSession?.enabled);
}

/**
 * Deactivates mission state (e.g., on cancellation or error).
 */
export function deactivateMissionState(sessionID: string): void {
    const stateSession = state.sessions.get(sessionID);
    if (stateSession) {
        stateSession.enabled = false;
    }
    state.missionActive = false;
    log(`[SessionManager] Mission Deactivated: ${sessionID}`);
}

// Cost Estimations (USD)
const COST_PER_1K_INPUT = 0.003;
const COST_PER_1K_OUTPUT = 0.015;

/**
 * Updates token usage and estimated cost for a session.
 */
export function updateSessionTokens(
    sessions: Map<string, any>,
    sessionID: string,
    inputLen: number,
    outputLen: number
): void {
    const session = ensureSessionInitialized(sessions, sessionID);

    if (!session.tokens) {
        session.tokens = { totalInput: 0, totalOutput: 0, estimatedCost: 0 };
    }

    // Heuristic: ~4 chars per token
    const inputTokens = Math.ceil(inputLen / 4);
    const outputTokens = Math.ceil(outputLen / 4);

    session.tokens.totalInput += inputTokens;
    session.tokens.totalOutput += outputTokens;

    const cost = (session.tokens.totalInput / 1000 * COST_PER_1K_INPUT) +
        (session.tokens.totalOutput / 1000 * COST_PER_1K_OUTPUT);

    session.tokens.estimatedCost = Number(cost.toFixed(4));
}

/**
 * Anomaly Management
 */
export function recordAnomaly(sessionID: string): number {
    const session = ensureGlobalState(sessionID);
    session.anomalyCount = (session.anomalyCount || 0) + 1;
    return session.anomalyCount;
}

export function resetAnomaly(sessionID: string): void {
    const session = ensureGlobalState(sessionID);
    session.anomalyCount = 0;
}

/**
 * Task Tracking
 */
export function updateCurrentTask(sessionID: string, taskID: string): void {
    const session = ensureGlobalState(sessionID);
    session.currentTask = taskID;
}
