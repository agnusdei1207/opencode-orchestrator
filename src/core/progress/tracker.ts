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
} from "./interfaces/index.js";

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
