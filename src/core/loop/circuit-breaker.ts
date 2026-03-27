/**
 * Circuit Breaker - Loop Detection and Prevention
 * 
 * Detects repetitive patterns and trips the circuit to prevent
 * infinite loops. Uses tool call history for pattern detection.
 */

import { log } from "../agents/logger.js";

export interface CircuitBreakerState {
    lastAccessedAt: number;
    lastTrippedAt: number;
    isOpen: boolean;
    toolCallHistory: string[];
}

const REPETITION_THRESHOLD = 3;
const HISTORY_SIZE = 10;
const CIRCUIT_TTL_MS = 10 * 60 * 1000;
const CIRCUIT_RESET_TIMEOUT_MS = 30 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const circuitStates = new Map<string, CircuitBreakerState>();

// TTL-based pruning to prevent memory leaks
let pruneInterval: ReturnType<typeof setInterval> | undefined;

function startPruneTimer(): void {
    if (pruneInterval) return;
    
    pruneInterval = setInterval(() => {
        const now = Date.now();
        for (const [sessionID, state] of circuitStates.entries()) {
            if (now - state.lastAccessedAt > CIRCUIT_TTL_MS) {
                circuitStates.delete(sessionID);
                log(`[circuit-breaker] Pruned stale state`, { sessionID });
            }
        }
    }, PRUNE_INTERVAL_MS);
    
    if (pruneInterval && typeof pruneInterval.unref === "function") {
        pruneInterval.unref();
    }
}

function getState(sessionID: string): CircuitBreakerState {
    let state = circuitStates.get(sessionID);
    if (!state) {
        state = {
            lastAccessedAt: Date.now(),
            lastTrippedAt: 0,
            isOpen: false,
            toolCallHistory: [],
        };
        circuitStates.set(sessionID, state);
    } else {
        state.lastAccessedAt = Date.now();
    }
    return state;
}

export function isCircuitOpen(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    if (!state) return false;
    
    state.lastAccessedAt = Date.now();
    
    if (state.isOpen) {
        const now = Date.now();
        if (now - state.lastTrippedAt > CIRCUIT_RESET_TIMEOUT_MS) {
            state.isOpen = false;
            state.toolCallHistory = [];
            log(`[circuit-breaker] Circuit HALF-OPEN (auto-reset)`, { sessionID });
            return false;
        }
        return true;
    }
    
    return false;
}

export function detectRepetitiveToolUse(sessionID: string): string | null {
    const state = circuitStates.get(sessionID);
    if (!state || state.toolCallHistory.length < REPETITION_THRESHOLD) {
        return null;
    }
    
    const recent = state.toolCallHistory.slice(-REPETITION_THRESHOLD);
    if (recent.every((tool) => tool === recent[0])) {
        return recent[0];
    }
    
    return null;
}

export function shouldTripCircuit(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    if (!state) return false;
    
    if (state.isOpen) return false;
    
    const repetitiveTool = detectRepetitiveToolUse(sessionID);
    if (repetitiveTool) {
        state.isOpen = true;
        state.lastTrippedAt = Date.now();
        log(`[circuit-breaker] Circuit OPENED: repetitive tool detected: ${repetitiveTool}`, { sessionID });
        return true;
    }
    
    return false;
}

export function recordToolCall(sessionID: string, toolName: string): void {
    const state = getState(sessionID);
    state.toolCallHistory.push(toolName);
    
    if (state.toolCallHistory.length > HISTORY_SIZE) {
        state.toolCallHistory.shift();
    }
}

export function clearCircuitState(sessionID: string): void {
    circuitStates.delete(sessionID);
}

export function getCircuitState(sessionID: string): CircuitBreakerState | undefined {
    return circuitStates.get(sessionID);
}

export function shutdownCircuitBreaker(): void {
    if (pruneInterval) {
        clearInterval(pruneInterval);
        pruneInterval = undefined;
    }
    circuitStates.clear();
}

// Start prune timer on module load
startPruneTimer();
