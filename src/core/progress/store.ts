/**
 * Progress Store - Session data management
 */

import type { ProgressSnapshot, SnapshotInput } from "./interfaces.js";
import { HISTORY } from "../../shared/index.js";

// Progress history by session
const progressHistory = new Map<string, ProgressSnapshot[]>();
const sessionStartTimes = new Map<string, Date>();

/**
 * Start tracking a session
 */
export function startSession(sessionId: string): void {
    sessionStartTimes.set(sessionId, new Date());
    progressHistory.set(sessionId, []);
}

/**
 * Get session start time
 */
export function getSessionStart(sessionId: string): Date | undefined {
    return sessionStartTimes.get(sessionId);
}

/**
 * Record a progress snapshot
 */
export function recordSnapshot(sessionId: string, data: SnapshotInput): ProgressSnapshot {
    const startedAt = sessionStartTimes.get(sessionId) || new Date();
    const now = new Date();

    const snapshot: ProgressSnapshot = {
        sessionId,
        timestamp: now,
        todos: {
            total: data.todoTotal || 0,
            completed: data.todoCompleted || 0,
            pending: (data.todoTotal || 0) - (data.todoCompleted || 0),
            percentage: data.todoTotal
                ? Math.round((data.todoCompleted || 0) / data.todoTotal * 100)
                : 0,
        },
        tasks: {
            total: data.taskTotal || 0,
            running: data.taskRunning || 0,
            completed: data.taskCompleted || 0,
            failed: data.taskFailed || 0,
            percentage: data.taskTotal
                ? Math.round(((data.taskCompleted || 0) + (data.taskFailed || 0)) / data.taskTotal * 100)
                : 0,
        },
        steps: {
            current: data.currentStep || 0,
            max: data.maxSteps || Infinity,
        },
        startedAt,
        elapsedMs: now.getTime() - startedAt.getTime(),
    };

    const history = progressHistory.get(sessionId) || [];
    history.push(snapshot);

    if (history.length > HISTORY.MAX_PROGRESS) {
        history.shift();
    }

    progressHistory.set(sessionId, history);
    return snapshot;
}

/**
 * Get latest snapshot
 */
export function getLatest(sessionId: string): ProgressSnapshot | undefined {
    const history = progressHistory.get(sessionId);
    return history?.[history.length - 1];
}

/**
 * Get progress history
 */
export function getHistory(sessionId: string, limit = 20): ProgressSnapshot[] {
    const history = progressHistory.get(sessionId) || [];
    return history.slice(-limit);
}

/**
 * Clear session data
 */
export function clearSession(sessionId: string): void {
    progressHistory.delete(sessionId);
    sessionStartTimes.delete(sessionId);
}
