/**
 * Continuation Lock - Ensures single execution of continuation logic
 * 
 * Prevents simultaneous execution of Mission Loop and Todo Continuation systems.
 * This resolves infinite loading issues caused by duplicate prompt injections.
 * 
 * @example
 * if (!tryAcquireContinuationLock(sessionID)) {
 *     return; // Another system is already processing
 * }
 * try {
 *     // continuation logic
 * } finally {
 *     releaseContinuationLock(sessionID);
 * }
 */

import { log } from "../agents/logger.js";

interface ContinuationLockState {
    acquired: boolean;
    timestamp: number;
    source?: string;  // Records which system acquired the lock
}

const locks = new Map<string, ContinuationLockState>();

// Configuration
const LOCK_TIMEOUT_MS = 30000;  // Auto-release after 30s (Deadlock prevention)

/**
 * Try to acquire the continuation lock
 * 
 * @param sessionID - Session ID
 * @param source - Source requesting the lock (for debugging)
 * @returns true if acquired, false otherwise
 */
export function tryAcquireContinuationLock(sessionID: string, source?: string): boolean {
    const now = Date.now();
    const existing = locks.get(sessionID);

    // Deny if lock exists and hasn't timed out
    if (existing?.acquired) {
        const elapsed = now - existing.timestamp;

        if (elapsed < LOCK_TIMEOUT_MS) {
            log("[continuation-lock] Lock denied - already held", {
                sessionID: sessionID.slice(0, 8),
                heldBy: existing.source,
                requestedBy: source,
                elapsedMs: elapsed,
            });
            return false;
        }

        // Timeout - Force release stale lock and re-acquire
        log("[continuation-lock] Forcing stale lock release", {
            sessionID: sessionID.slice(0, 8),
            staleSource: existing.source,
            elapsedMs: elapsed,
        });
    }

    locks.set(sessionID, { acquired: true, timestamp: now, source });
    log("[continuation-lock] Lock acquired", {
        sessionID: sessionID.slice(0, 8),
        source,
    });

    return true;
}

/**
 * Release the continuation lock
 * 
 * @param sessionID - Session ID
 */
export function releaseContinuationLock(sessionID: string): void {
    const existing = locks.get(sessionID);
    if (existing?.acquired) {
        const duration = Date.now() - existing.timestamp;
        log("[continuation-lock] Lock released", {
            sessionID: sessionID.slice(0, 8),
            source: existing.source,
            heldMs: duration,
        });
    }
    locks.delete(sessionID);
}

/**
 * Check if the lock is currently active
 * 
 * @param sessionID - Session ID
 * @returns true if lock is held
 */
export function hasContinuationLock(sessionID: string): boolean {
    const lock = locks.get(sessionID);
    if (!lock?.acquired) return false;

    // Check timeout
    if ((Date.now() - lock.timestamp) >= LOCK_TIMEOUT_MS) {
        log("[continuation-lock] Stale lock detected during check", {
            sessionID: sessionID.slice(0, 8),
        });
        locks.delete(sessionID);
        return false;
    }

    return true;
}

/**
 * Cleanup lock when session is cleaned up
 * 
 * @param sessionID - Session ID
 */
export function cleanupContinuationLock(sessionID: string): void {
    locks.delete(sessionID);
}

/**
 * Clear all locks (for testing)
 */
export function clearAllLocks(): void {
    locks.clear();
}

/**
 * Get lock status (for debugging)
 */
export function getLockStatus(sessionID: string): ContinuationLockState | undefined {
    return locks.get(sessionID);
}
