/**
 * Progress Tracker Module
 * 
 * Tracks progress of sessions, tasks, and todos
 */

// Re-export interfaces
export type { TodoProgress } from "./interfaces/todo-progress.js";
export type { TaskProgress } from "./interfaces/task-progress.js";
export type { StepProgress } from "./interfaces/step-progress.js";
export type { ProgressSnapshot } from "./interfaces/progress-snapshot.js";
export type { SnapshotInput } from "./interfaces/snapshot-input.js";

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
