/**
 * Toast Core - Core notification functions
 * Uses OpenCode TUI's showToast API for actual UI display
 */

import type { ToastMessage, ToastOptions, ToastVariant } from "../../shared/index.js";
import type { PluginInput } from "@opencode-ai/plugin";
import { HISTORY, LIMITS } from "../../shared/index.js";

type OpencodeClient = PluginInput["client"];

// Store the OpenCode client for TUI access
let tuiClient: OpencodeClient | null = null;

/**
 * Initialize the toast system with the OpenCode client
 */
// Initialize the toast system with the OpenCode client
// Returns a cleanup function to detach and purge any in-memory state
export function initToastClient(client: OpencodeClient): () => void {
    tuiClient = client;
    // Cleanup function to avoid leaks when the host/application is disposed
    const cleanup = () => {
        // detach client and clear in-memory state
        tuiClient = null;
        // purge toasts/history and listeners to prevent leaks
        toasts.length = 0;
        handlers.length = 0;
    };
    return cleanup;
}

// Toast history
const toasts: ToastMessage[] = [];

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
    if (toasts.length > HISTORY.MAX_TOAST) {
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
        const client = tuiClient as unknown as { tui?: { showToast?: (opts: any) => Promise<void> } };
        if (client.tui?.showToast) {
            try {
                // AbortController provides a cancel mechanism for async operations
                const ac = new AbortController();
                // Timeout based on toast duration to protect against hangs
                const timeoutMs = Math.max(2000, Math.min(toast.duration, 10000));
                const timer = setTimeout(() => {
                    try {
                        ac.abort();
                    } catch {
                        // ignore
                    }
                }, timeoutMs);

                const promise = client.tui.showToast?.({
                    body: {
                        title: toast.title,
                        message: toast.message,
                        variant: toast.variant,
                        duration: toast.duration,
                    },
                    signal: (ac as any).signal,
                } as any);

                if (promise && typeof promise.then === "function") {
                    Promise.resolve(promise).finally(() => {
                        if (timer) {
                            clearTimeout(timer);
                        }
                    }).catch(() => {
                        // swallow errors from toast display
                    });
                }
            } catch {
                // Silently ignore errors in the toast pipeline
            }
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
export function getHistory(limit: number = LIMITS.DEFAULT_LIST_LIMIT): ToastMessage[] {
    return toasts.slice(-limit);
}

/**
 * Clear all toasts
 */
export function clear(): void {
    toasts.length = 0;
}
