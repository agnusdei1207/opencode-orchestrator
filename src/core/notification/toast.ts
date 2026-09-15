/**
 * Toast Notification System
 * 
 * Provides notifications for task events, completions, errors
 */

// Re-export core functions
export { show, dismiss, getHistory, clear, initToastClient } from "./toast-core.js";

// Re-export presets
export * as presets from "./presets.js";

// Re-export task toast manager
export {
    TaskToastManager,
    getTaskToastManager,
    initTaskToastManager,
} from "./task-toast-manager.js";
