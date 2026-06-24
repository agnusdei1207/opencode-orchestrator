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
export * as presets from "./presets.js";

// Re-export task toast manager
export {
    TaskToastManager,
    getTaskToastManager,
    initTaskToastManager,
} from "./task-toast-manager.js";
export type { TrackedTask, TaskStatus, TaskCompletionInfo } from "../../shared/index.js";
