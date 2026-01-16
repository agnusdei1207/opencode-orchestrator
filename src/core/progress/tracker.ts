/**
 * Progress Tracker Module
 * 
 * Tracks progress of sessions, tasks, and todos
 */

// Re-export interfaces
export type {
    TodoProgress,
    TaskProgress,
    StepProgress,
    ProgressSnapshot,
    SnapshotInput,
} from "./interfaces.js";

// Re-export store operations
export {
    startSession,
    getSessionStart,
    recordSnapshot,
    getLatest,
    getHistory,
    clearSession,
} from "./store.js";

// Re-export formatters
export {
    formatElapsed,
    formatProgressBar,
    formatSnapshot,
} from "./formatters.js";

// Re-export calculators
export {
    calculateRate,
    estimateRemaining,
} from "./calculator.js";

// Convenience functions for backward compatibility
import { getLatest } from "./store.js";
import { formatSnapshot as formatSnapshotImpl, formatCompact as formatCompactImpl } from "./formatters.js";

export function format(sessionId: string): string {
    const snapshot = getLatest(sessionId);
    if (!snapshot) return "No progress data";
    return formatSnapshotImpl(snapshot);
}

export function formatCompact(sessionId: string): string {
    const snapshot = getLatest(sessionId);
    if (!snapshot) return "...";
    return formatCompactImpl(snapshot);
}
