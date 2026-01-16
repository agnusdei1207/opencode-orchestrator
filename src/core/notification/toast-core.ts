/**
 * Toast Core - Core notification functions
 */

import type { ToastMessage, ToastOptions, ToastVariant } from "./types.js";

// Toast history
const toasts: ToastMessage[] = [];
const MAX_HISTORY = 50;

// Notification handlers
const handlers: Array<(toast: ToastMessage) => void> = [];

/**
 * Register a notification handler
 */
export function onToast(handler: (toast: ToastMessage) => void): () => void {
    handlers.push(handler);
    return () => {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
    };
}

/**
 * Show a toast notification
 */
export function show(options: ToastOptions): ToastMessage {
    const toast: ToastMessage = {
        id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: options.title,
        message: options.message,
        variant: options.variant || "info",
        timestamp: new Date(),
        duration: options.duration ?? 5000,
        dismissed: false,
    };

    toasts.push(toast);
    if (toasts.length > MAX_HISTORY) {
        toasts.shift();
    }

    // Notify handlers
    for (const handler of handlers) {
        try {
            handler(toast);
        } catch (error) {
            console.error("[Toast] Handler error:", error);
        }
    }

    // Log to console with emoji
    const icons = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" };
    console.log(`${icons[toast.variant]} [${toast.title}] ${toast.message}`);

    return toast;
}

/**
 * Dismiss a toast
 */
export function dismiss(toastId: string): void {
    const toast = toasts.find(t => t.id === toastId);
    if (toast) {
        toast.dismissed = true;
    }
}

/**
 * Get active (non-dismissed) toasts
 */
export function getActive(): ToastMessage[] {
    return toasts.filter(t => !t.dismissed);
}

/**
 * Get toast history
 */
export function getHistory(limit = 20): ToastMessage[] {
    return toasts.slice(-limit);
}

/**
 * Clear all toasts
 */
export function clear(): void {
    toasts.length = 0;
}
