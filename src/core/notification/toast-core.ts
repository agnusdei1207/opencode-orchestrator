/**
 * Toast Core - Core notification functions
 * Uses OpenCode TUI's showToast API for actual UI display
 */

import type { ToastMessage, ToastOptions } from "../../shared/index.js";
import type { PluginInput } from "@opencode-ai/plugin";
import type { TuiShowToastData } from "@opencode-ai/sdk";
import { sanitizeToastMessage, sanitizeToastTitle } from "./toast-sanitizer.js";

type OpencodeClient = PluginInput["client"];
type ToastShowPayload = Omit<TuiShowToastData, "url"> & { signal?: AbortSignal };

/** Bounds for the TUI request timeout, which otherwise follows the toast duration. */
const TUI_TOAST_MIN_TIMEOUT_MS = 2000;
const TUI_TOAST_MAX_TIMEOUT_MS = 10000;

// Clients of the live plugin instances, newest last. One OpenCode process can
// serve several directories and disposes each instance on its own, so a toast
// must go through a client whose instance is still alive.
const tuiClients: OpencodeClient[] = [];

/**
 * Attach an instance's OpenCode client to the toast system.
 * Returns a cleanup function that detaches only that client when its instance is disposed.
 */
export function initToastClient(client: OpencodeClient): () => void {
    const entry = client;
    tuiClients.push(entry);
    let detached = false;
    return () => {
        if (detached) return;
        detached = true;
        const index = tuiClients.lastIndexOf(entry);
        if (index !== -1) tuiClients.splice(index, 1);
    };
}

function currentTuiClient(): OpencodeClient | null {
    return tuiClients.at(-1) ?? null;
}

/**
 * Show a sanitized toast notification in the OpenCode TUI, when one is attached.
 */
export function show(options: ToastOptions): ToastMessage {
    const toast: ToastMessage = {
        id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: sanitizeToastTitle(options.title),
        message: sanitizeToastMessage(options.message),
        variant: options.variant || "info",
        timestamp: new Date(),
        duration: options.duration ?? 5000,
    };

    const tuiClient = currentTuiClient();
    if (tuiClient) {
        showInTui(tuiClient, toast);
    }

    return toast;
}

function showInTui(client: OpencodeClient, toast: ToastMessage): void {
    if (!client.tui?.showToast) return;
    try {
        // AbortController provides a cancel mechanism for async operations
        const ac = new AbortController();
        // Timeout based on toast duration to protect against hangs
        const timeoutMs = Math.max(TUI_TOAST_MIN_TIMEOUT_MS, Math.min(toast.duration, TUI_TOAST_MAX_TIMEOUT_MS));
        const timer = setTimeout(() => {
            try {
                ac.abort();
            } catch {
                // ignore
            }
        }, timeoutMs);

        const payload: ToastShowPayload = {
            body: {
                title: toast.title,
                message: toast.message,
                variant: toast.variant,
                duration: toast.duration,
            },
            signal: ac.signal,
        };

        Promise.resolve(client.tui.showToast(payload)).finally(() => {
            clearTimeout(timer);
        }).catch(() => {
            // swallow errors from toast display
        });
    } catch {
        // Silently ignore errors in the toast pipeline
    }
}
