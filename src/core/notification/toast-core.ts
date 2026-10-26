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

// Store the OpenCode client for TUI access
let tuiClient: OpencodeClient | null = null;

/**
 * Initialize the toast system with the OpenCode client.
 * Returns a cleanup function that detaches the client when the host is disposed.
 */
export function initToastClient(client: OpencodeClient): () => void {
    tuiClient = client;
    return () => {
        tuiClient = null;
    };
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
