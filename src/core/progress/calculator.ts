/**
 * Progress Calculator - Rate and estimation calculations
 */

import { getLatest } from "./store.js";

/**
 * Calculate rate (items per minute)
 */
export function calculateRate(sessionId: string): number {
    const snapshot = getLatest(sessionId);
    if (!snapshot || snapshot.elapsedMs === 0) return 0;

    const completedItems = snapshot.todos.completed + snapshot.tasks.completed;
    const minutes = snapshot.elapsedMs / 60000;

    return Math.round(completedItems / minutes * 10) / 10;
}

/**
 * Estimate remaining time in ms
 */
export function estimateRemaining(sessionId: string): number | undefined {
    const snapshot = getLatest(sessionId);
    if (!snapshot) return undefined;

    const rate = calculateRate(sessionId);
    if (rate === 0) return undefined;

    const remaining = snapshot.todos.pending +
        (snapshot.tasks.total - snapshot.tasks.completed - snapshot.tasks.failed);

    return remaining / rate * 60000;
}
