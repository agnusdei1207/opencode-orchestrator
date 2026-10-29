import { log } from "../agents/logger.js";

/**
 * Session Manager
 * 
 * Centralizes all direct access to the global `state` and session initialization logic.
 * Eliminates redundant state checks across hooks and handlers.
 */

/**
 * Rehydrates session state from directory if it exists on disk.
 * This ensures survival across plugin reloads.
 */
import { readLoopState } from "../loop/mission-loop.js";
import { isRecord } from "../../shared/core/guards.js";

interface ManagedSessionState {
    active: boolean;
    step: number;
    timestamp: number;
    startTime: number;
    lastStepTime: number;
    lastCompletedMessageID?: string;
    lastUserMessageAt?: number;
    lastAssistantCompletedAt?: number;
    lastAbortAt?: number;
    tokens: {
        totalInput: number;
        totalOutput: number;
    };
}

/**
 * Ensures a local session object exists in the plugin context map.
 * Now WITH disk-based rehydration for robustness.
 */
export function ensureSessionInitialized(
    sessions: Map<string, unknown>,
    sessionID: string,
    directory?: string
): ManagedSessionState {
    if (!sessions.has(sessionID)) {
        const newSession = createManagedSession();

        // Rehydration attempt: If directory is provided, check mission loop state
        if (directory) {
            const diskState = readLoopState(directory);
            if (diskState && diskState.sessionID === sessionID) {
                newSession.step = diskState.iteration;
                newSession.startTime = new Date(diskState.startedAt).getTime();
                log(`[SessionManager] Rehydrated session from disk: ${sessionID}`);
            }
        }

        sessions.set(sessionID, newSession);
        return newSession;
    }

    const session = sessions.get(sessionID);
    if (isManagedSessionState(session)) return session;

    if (isRecord(session)) {
        return normalizeManagedSession(session);
    }

    const newSession = createManagedSession();
    sessions.set(sessionID, newSession);
    return newSession;
}

/**
 * Updates the estimated token usage for a session.
 */
export function updateSessionTokens(
    sessions: Map<string, unknown>,
    sessionID: string,
    inputLen: number,
    outputLen: number
): void {
    const session = ensureSessionInitialized(sessions, sessionID);

    if (!session.tokens) {
        session.tokens = { totalInput: 0, totalOutput: 0 };
    }

    // Heuristic: ~4 chars per token
    const inputTokens = Math.ceil(inputLen / 4);
    const outputTokens = Math.ceil(outputLen / 4);

    session.tokens.totalInput += inputTokens;
    session.tokens.totalOutput += outputTokens;
}

function createManagedSession(): ManagedSessionState {
    const now = Date.now();
    return {
        active: true,
        step: 0,
        timestamp: now,
        startTime: now,
        lastStepTime: now,
        lastCompletedMessageID: undefined,
        lastUserMessageAt: undefined,
        lastAssistantCompletedAt: undefined,
        lastAbortAt: undefined,
        tokens: { totalInput: 0, totalOutput: 0 },
    };
}

function normalizeManagedSession(session: Record<string, unknown>): ManagedSessionState {
    const now = Date.now();
    if (typeof session.active !== "boolean") session.active = true;
    if (!isFiniteNumber(session.step)) session.step = 0;
    if (!isFiniteNumber(session.timestamp)) session.timestamp = now;
    if (!isFiniteNumber(session.startTime)) session.startTime = now;
    if (!isFiniteNumber(session.lastStepTime)) session.lastStepTime = now;
    if (!isTokenUsage(session.tokens)) {
        session.tokens = { totalInput: 0, totalOutput: 0 };
    }
    if (isManagedSessionState(session)) return session;

    throw new Error("Failed to normalize managed session state");
}

function isManagedSessionState(value: unknown): value is ManagedSessionState {
    return isRecord(value)
        && typeof value.active === "boolean"
        && isFiniteNumber(value.step)
        && isFiniteNumber(value.timestamp)
        && isFiniteNumber(value.startTime)
        && isFiniteNumber(value.lastStepTime)
        && isTokenUsage(value.tokens);
}

function isTokenUsage(value: unknown): value is ManagedSessionState["tokens"] {
    if (!isRecord(value)) return false;
    return isFiniteNumber(value.totalInput) && isFiniteNumber(value.totalOutput);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/**
 * Anomaly Management
 */
