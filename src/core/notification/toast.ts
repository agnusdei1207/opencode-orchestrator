/**
 * Toast Notification System
 * 
 * Provides notifications for task events, completions, errors
 */

// Re-export types
export type { ToastVariant, ToastMessage, ToastOptions } from "./types.js";

// Re-export core functions
export { show, dismiss, getActive, getHistory, clear, onToast, initToastClient } from "./toast-core.js";

// Re-export presets
export { presets } from "./presets.js";
