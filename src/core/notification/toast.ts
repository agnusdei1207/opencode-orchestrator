/**
 * Toast Notification System
 * 
 * Provides notifications for task events, completions, errors
 */

// Re-export types
export type { ToastVariant, ToastMessage, ToastOptions } from "../../shared/index.js";

// Re-export core functions
export { show, dismiss, getActive, getHistory, clear, onToast, initToastClient } from "./toast-core.js";

// Re-export presets
export { presets } from "../../shared/index.js";

// Re-export task toast manager
export {
    TaskToastManager,
    getTaskToastManager,
    initTaskToastManager,
    type TrackedTask,
    type TaskStatus,
    type TaskCompletionInfo,
} from "./task-toast-manager.js";
