/**
 * Toast Core - Core notification functions
 * Uses OpenCode TUI's showToast API for actual UI display
 */

import type { ToastMessage, ToastOptions, ToastVariant } from "./types.js";
import type { PluginInput } from "@opencode-ai/plugin";

type OpencodeClient = PluginInput["client"];

// Store the OpenCode client for TUI access
let tuiClient: OpencodeClient | null = null;

/**
 * Initialize the toast system with the OpenCode client
 */
export function initToastClient(client: OpencodeClient): void {
    tuiClient = client;
}

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
 * Show a toast notification (both in TUI and internal storage)
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
            // Ignore handler errors
        }
    }

    // Show in OpenCode TUI if available
    if (tuiClient) {
        const client = tuiClient as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (client.tui?.showToast) {
            client.tui.showToast({
                body: {
                    title: toast.title,
                    message: toast.message,
                    variant: toast.variant,
                    duration: toast.duration,
                },
            }).catch(() => { });
        }
    }

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

