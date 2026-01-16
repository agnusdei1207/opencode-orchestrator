/**
 * Toast Notification System
 * 
 * Provides notifications for task events, completions, errors
 * Works through Event Bus
 */

import {
    EventBus,
    TASK_EVENTS,
    MISSION_EVENTS,
    DOCUMENT_EVENTS
} from "../bus/index.js";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    variant: ToastVariant;
    timestamp: Date;
    duration: number;  // ms, 0 = persistent
    dismissed: boolean;
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
 * Show a toast notification
 */
export function show(options: {
    title: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
}): ToastMessage {
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

// ============================================================================
// Preset Notifications
// ============================================================================

export const presets = {
    taskStarted: (taskId: string, agent: string) => show({
        title: "Task Started",
        message: `${agent}: ${taskId}`,
        variant: "info",
        duration: 3000,
    }),

    taskCompleted: (taskId: string, agent: string) => show({
        title: "Task Completed",
        message: `${agent}: ${taskId}`,
        variant: "success",
        duration: 3000,
    }),

    taskFailed: (taskId: string, error: string) => show({
        title: "Task Failed",
        message: `${taskId}: ${error}`,
        variant: "error",
        duration: 0,  // Persistent
    }),

    allTasksComplete: (count: number) => show({
        title: "All Tasks Complete",
        message: `${count} tasks finished successfully`,
        variant: "success",
        duration: 5000,
    }),

    missionComplete: (summary: string) => show({
        title: "🎉 Mission Complete",
        message: summary,
        variant: "success",
        duration: 0,
    }),

    documentCached: (filename: string) => show({
        title: "Document Cached",
        message: `.cache/docs/${filename}`,
        variant: "info",
        duration: 2000,
    }),

    researchStarted: (topic: string) => show({
        title: "Research Started",
        message: topic,
        variant: "info",
        duration: 3000,
    }),

    warningRateLimited: () => show({
        title: "Rate Limited",
        message: "Waiting before retry...",
        variant: "warning",
        duration: 5000,
    }),

    errorRecovery: (action: string) => show({
        title: "Error Recovery",
        message: `Attempting: ${action}`,
        variant: "warning",
        duration: 3000,
    }),
};

// ============================================================================
// Event Bus Integration
// ============================================================================

/**
 * Auto-subscribe to events and show toasts
 */
export function enableAutoToasts(): () => void {
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(EventBus.subscribe(TASK_EVENTS.STARTED, (event) => {
        const { taskId, agent } = event.properties as { taskId: string; agent: string };
        presets.taskStarted(taskId, agent);
    }));

    unsubscribers.push(EventBus.subscribe(TASK_EVENTS.COMPLETED, (event) => {
        const { taskId, agent } = event.properties as { taskId: string; agent: string };
        presets.taskCompleted(taskId, agent);
    }));

    unsubscribers.push(EventBus.subscribe(TASK_EVENTS.FAILED, (event) => {
        const { taskId, error } = event.properties as { taskId: string; error: string };
        presets.taskFailed(taskId, error);
    }));

    unsubscribers.push(EventBus.subscribe(MISSION_EVENTS.ALL_TASKS_COMPLETE, (event) => {
        const { count } = event.properties as { count: number };
        presets.allTasksComplete(count);
    }));

    unsubscribers.push(EventBus.subscribe(MISSION_EVENTS.COMPLETE, (event) => {
        const { summary } = event.properties as { summary: string };
        presets.missionComplete(summary);
    }));

    unsubscribers.push(EventBus.subscribe(DOCUMENT_EVENTS.CACHED, (event) => {
        const { filename } = event.properties as { filename: string };
        presets.documentCached(filename);
    }));

    return () => {
        for (const unsub of unsubscribers) {
            unsub();
        }
    };
}
