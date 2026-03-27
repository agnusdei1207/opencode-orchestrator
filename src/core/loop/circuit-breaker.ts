/**
 * Circuit Breaker - Loop Detection and Prevention
 * 
 * Detects repetitive patterns and trips the circuit to prevent
 * infinite loops. Based on failure count and tool usage patterns.
 */

import { log } from "../agents/logger.js";

export interface CircuitBreakerState {
    failureCount: number;
    lastFailureTime: number;
    isOpen: boolean;
    toolCallHistory: string[];
}

export interface ToolCall {
    name: string;
    timestamp?: number;
}

export const FAILURE_THRESHOLD = 5;
export const CIRCUIT_RESET_TIMEOUT_MS = 30 * 1000;
const REPETITION_THRESHOLD = 3;
const HISTORY_SIZE = 10;

const circuitStates = new Map<string, CircuitBreakerState>();

function getState(sessionID: string): CircuitBreakerState {
    let state = circuitStates.get(sessionID);
    if (!state) {
        state = {
            failureCount: 0,
            lastFailureTime: 0,
            isOpen: false,
            toolCallHistory: [],
        };
        circuitStates.set(sessionID, state);
    }
    return state;
}

export function recordFailure(sessionID: string): void {
    const state = getState(sessionID);
    state.failureCount += 1;
    state.lastFailureTime = Date.now();
    
    if (state.failureCount >= FAILURE_THRESHOLD) {
        state.isOpen = true;
        log(`[circuit-breaker] Circuit OPENED`, {
            sessionID,
            failureCount: state.failureCount,
            threshold: FAILURE_THRESHOLD,
        });
    }
}

export function recordSuccess(sessionID: string): void {
    const state = getState(sessionID);
    state.failureCount = 0;
    state.isOpen = false;
    state.toolCallHistory = [];
}

export function isCircuitOpen(sessionID: string): boolean {
    const state = circuitStates.get(sessionID);
    if (!state) return false;
    
    if (state.isOpen) {
        const now = Date.now();
        if (now - state.lastFailureTime > CIRCUIT_RESET_TIMEOUT_MS) {
            state.isOpen = false;
            state.failureCount = 0;
            log(`[circuit-breaker] Circuit HALF-OPEN (auto-reset)`, { sessionID });
            return false;
        }
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
    
    if (state.failureCount >= FAILURE_THRESHOLD) {
        return true;
    }
    
    const repetitiveTool = detectRepetitiveToolUse(sessionID);
    if (repetitiveTool) {
        log(`[circuit-breaker] Repetitive tool detected: ${repetitiveTool}`, { sessionID });
        return true;
    }
    
    return false;
}

export function clearCircuitState(sessionID: string): void {
    circuitStates.delete(sessionID);
}

export function getCircuitState(sessionID: string): CircuitBreakerState | undefined {
    return circuitStates.get(sessionID);
}
