/**
 * Circuit Breaker - Loop Detection and Prevention
 *
 * Detects repetitive patterns and trips the circuit to prevent
 * infinite loops. Two signals feed it:
 *
 * - Tool call history: the same tool called three times in a row.
 * - Assistant turn history: three consecutive completed turns with no tool
 *   call and the same text (issue #39). A model that keeps echoing a system
 *   reminder instead of acting is not making progress, and every idle
 *   re-prompt from the continuation loops would only make it echo again.
 */

import { log } from "../agents/logger.js";
import { createPruneTimer } from "./prune-timer.js";

export type CircuitTripCause = "tool" | "output";

export interface CircuitBreakerState {
    lastAccessedAt: number;
    lastTrippedAt: number;
    isOpen: boolean;
    /** What opened the circuit; decides how long it stays open. */
    openedBy?: CircuitTripCause;
    toolCallHistory: string[];
    /** Digests of recent no-tool completed turns (equality is all we need). */
    idleTurnHistory: string[];
}

/**
 * Cheap order-sensitive digest (length + djb2). Only equality of consecutive
 * turns matters, so storing a digest instead of the full turn text avoids
 * holding megabytes of transcript per session for the circuit's 10-minute TTL.
 */
function digest(text: string): string {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    return `${text.length}:${hash >>> 0}`;
}

const REPETITION_THRESHOLD = 3;
const HISTORY_SIZE = 10;
const CIRCUIT_TTL_MS = 10 * 60 * 1000;
/**
 * A tool loop usually clears itself once the model is left alone briefly. A
 * model that repeats the same answer needs the user, so the pause is long.
 */
const CIRCUIT_RESET_TIMEOUT_MS: Record<CircuitTripCause, number> = {
    tool: 30 * 1000,
    output: 10 * 60 * 1000,
};
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const circuitStates = new Map<string, CircuitBreakerState>();

const pruneTimer = createPruneTimer({
    intervalMs: PRUNE_INTERVAL_MS,
    prune: () => {
        const now = Date.now();
        for (const [sessionID, state] of circuitStates.entries()) {
            if (now - state.lastAccessedAt > CIRCUIT_TTL_MS) {
                circuitStates.delete(sessionID);
                log(`[circuit-breaker] Pruned stale state`, { sessionID });
            }
        }
    }
});

function getState(sessionID: string): CircuitBreakerState {
    let state = circuitStates.get(sessionID);
    if (!state) {
        state = {
            lastAccessedAt: Date.now(),
            lastTrippedAt: 0,
            isOpen: false,
            toolCallHistory: [],
            idleTurnHistory: [],
        };
        circuitStates.set(sessionID, state);
    } else {
        state.lastAccessedAt = Date.now();
    }
    return state;
}

function pushBounded(history: string[], entry: string): void {
    history.push(entry);
    if (history.length > HISTORY_SIZE) {
        history.shift();
    }
}

function lastEntriesIdentical(history: string[]): boolean {
    if (history.length < REPETITION_THRESHOLD) return false;

    const recent = history.slice(-REPETITION_THRESHOLD);
    return recent.every((entry) => entry === recent[0]);
}

function openCircuit(state: CircuitBreakerState, cause: CircuitTripCause): void {
    state.isOpen = true;
    state.openedBy = cause;
    state.lastTrippedAt = Date.now();
}

export function isCircuitOpen(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    if (!state) return false;

    state.lastAccessedAt = Date.now();

    if (state.isOpen) {
        const now = Date.now();
        const resetAfter = CIRCUIT_RESET_TIMEOUT_MS[state.openedBy ?? "tool"];
        if (now - state.lastTrippedAt > resetAfter) {
            state.isOpen = false;
            state.openedBy = undefined;
            state.toolCallHistory = [];
            state.idleTurnHistory = [];
            log(`[circuit-breaker] Circuit HALF-OPEN (auto-reset)`, { sessionID });
            return false;
        }
        return true;
    }

    return false;
}

export function detectRepetitiveToolUse(sessionID: string): string | null {
    const state = circuitStates.get(sessionID);
    if (!state || !lastEntriesIdentical(state.toolCallHistory)) {
        return null;
    }

    return state.toolCallHistory[state.toolCallHistory.length - 1];
}

/** True when the last three completed turns made no tool call and said the same thing. */
export function detectRepetitiveOutput(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    return state !== undefined && lastEntriesIdentical(state.idleTurnHistory);
}

export function shouldTripCircuit(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    if (!state) return false;

    if (state.isOpen) return false;

    const repetitiveTool = detectRepetitiveToolUse(sessionID);
    if (repetitiveTool) {
        openCircuit(state, "tool");
        log(`[circuit-breaker] Circuit OPENED: repetitive tool detected: ${repetitiveTool}`, { sessionID });
        return true;
    }

    if (detectRepetitiveOutput(sessionID)) {
        openCircuit(state, "output");
        log(`[circuit-breaker] Circuit OPENED: model repeated the same output without acting`, { sessionID });
        return true;
    }

    return false;
}

/**
 * Trip the circuit ONLY for repeated identical output, never for tool
 * repetition. Returns true if this call opened it. Used by the todo/mission
 * continuation guard, which must not pause a session just because a normal
 * turn happened to end in three same-named tool calls (issue #39 vs a
 * legitimate `read,read,read`).
 */
export function tripOutputCircuit(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    if (!state || state.isOpen) return false;

    if (detectRepetitiveOutput(sessionID)) {
        openCircuit(state, "output");
        log(`[circuit-breaker] Circuit OPENED: model repeated the same output without acting`, { sessionID });
        return true;
    }
    return false;
}

/** True when the circuit is open specifically because output kept repeating. */
export function isOutputCircuitOpen(sessionID: string): boolean {
    if (!isCircuitOpen(sessionID)) return false;
    return circuitStates.get(sessionID)?.openedBy === "output";
}

export function recordToolCall(sessionID: string, toolName: string): void {
    const state = getState(sessionID);
    pushBounded(state.toolCallHistory, toolName);
}

/**
 * Record a completed assistant turn. A turn that called a tool is progress
 * and clears the idle-turn history; a turn that only produced text is
 * remembered so identical repeats can be detected.
 *
 * An empty turn (no tool call and no text — an aborted, rate-limited, or
 * failed-to-read turn) is not a repeated *output*: recording it would let three
 * unrelated failures open the circuit and tell the user the model is looping
 * when it produced nothing. Such turns are skipped.
 */
export function recordAssistantTurn(sessionID: string, text: string, toolCallCount: number): void {
    const state = getState(sessionID);
    if (toolCallCount > 0) {
        state.idleTurnHistory = [];
        return;
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length === 0) return;

    pushBounded(state.idleTurnHistory, digest(normalized));
}

export function clearCircuitState(sessionID: string): void {
    circuitStates.delete(sessionID);
}

export function getCircuitState(sessionID: string): CircuitBreakerState | undefined {
    return circuitStates.get(sessionID);
}

export function shutdownCircuitBreaker(): void {
    pruneTimer.shutdown();
    circuitStates.clear();
}

pruneTimer.start();
