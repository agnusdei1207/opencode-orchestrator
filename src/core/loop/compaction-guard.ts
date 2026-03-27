/**
 * Compaction Guard - Prevents post-compaction Resume Errors
 * 
 * After session compaction, continuation prompts may reference deleted context.
 * This guard ensures continuation only happens after a newer compaction epoch.
 */

import { log } from "../agents/logger.js";

export interface CompactionGuardState {
    compactionEpoch: number;
    lastAccessedAt: number;
}

const COMPACTION_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const compactionStates = new Map<string, CompactionGuardState>();

let pruneInterval: ReturnType<typeof setInterval> | undefined;

function startPruneTimer(): void {
    if (pruneInterval) return;
    
    pruneInterval = setInterval(() => {
        const now = Date.now();
        for (const [sessionID, state] of compactionStates.entries()) {
            if (now - state.lastAccessedAt > COMPACTION_TTL_MS) {
                compactionStates.delete(sessionID);
                log(`[compaction-guard] Pruned stale state`, { sessionID });
            }
        }
    }, PRUNE_INTERVAL_MS);
    
    if (pruneInterval && typeof pruneInterval.unref === "function") {
        pruneInterval.unref();
    }
}

export function armCompactionGuard(sessionID: string, timestamp: number): number {
    let state = compactionStates.get(sessionID);
    if (!state) {
        state = { compactionEpoch: 0, lastAccessedAt: Date.now() };
        compactionStates.set(sessionID, state);
    }
    
    state.compactionEpoch = timestamp;
    state.lastAccessedAt = Date.now();
    
    log(`[compaction-guard] Armed`, { sessionID, epoch: timestamp });
    
    return timestamp;
}

export function isCompactionSafe(sessionID: string, currentEpoch: number): boolean {
    const state = compactionStates.get(sessionID);
    if (!state) return true;
    
    state.lastAccessedAt = Date.now();
    
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

export function shutdownCompactionGuard(): void {
    if (pruneInterval) {
        clearInterval(pruneInterval);
        pruneInterval = undefined;
    }
    compactionStates.clear();
}

startPruneTimer();
