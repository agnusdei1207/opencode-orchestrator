/**
 * Compaction Guard - Prevents post-compaction Resume Errors
 * 
 * After session compaction, continuation prompts may reference deleted context.
 * This guard ensures continuation only happens after compaction is armed.
 */

import { log } from "../agents/logger.js";

export interface CompactionGuardState {
    compactionEpoch: number;
    armed: boolean;
}

export const COMPACTION_GRACE_PERIOD_MS = 30 * 1000;

const compactionStates = new Map<string, CompactionGuardState>();

export function armCompactionGuard(sessionID: string, timestamp: number): number {
    let state = compactionStates.get(sessionID);
    if (!state) {
        state = { compactionEpoch: 0, armed: false };
        compactionStates.set(sessionID, state);
    }
    
    state.compactionEpoch = timestamp;
    state.armed = true;
    
    log(`[compaction-guard] Armed`, { sessionID, epoch: timestamp });
    
    return timestamp;
}

export function disarmCompactionGuard(sessionID: string): void {
    const state = compactionStates.get(sessionID);
    if (!state) return;
    
    state.armed = false;
    log(`[compaction-guard] Disarmed`, { sessionID });
}

export function isCompactionSafe(sessionID: string, currentEpoch: number): boolean {
    const state = compactionStates.get(sessionID);
    if (!state) return true;
    
    if (!state.armed) return true;
    
    if (currentEpoch > state.compactionEpoch) {
        log(`[compaction-guard] Unsafe: newer compaction exists`, {
            sessionID,
            currentEpoch,
            compactionEpoch: state.compactionEpoch,
        });
        return false;
    }
    
    return true;
}

export function clearCompactionState(sessionID: string): void {
    compactionStates.delete(sessionID);
}

export function getCompactionState(sessionID: string): CompactionGuardState | undefined {
    return compactionStates.get(sessionID);
}
