/**
 * Notification types and interfaces (consolidated)
 */
import type { TaskStatus } from "../core/index.js";

/**
 * Toast variant type
 */
export type ToastVariant = "info" | "success" | "warning" | "error";

/**
 * Toast display options
 */

export interface ToastOptions {
    title: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
}

/**
 * Toast message with metadata
 */

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    variant: ToastVariant;
    timestamp: Date;
    duration: number;
    dismissed: boolean;
}


export interface TrackedTask {
    id: string;
    description: string;
    agent: string;
    status: TaskStatus;
    startedAt: Date;
    isBackground: boolean;
    parentSessionID?: string;
    sessionID?: string;
}

export interface TaskCompletionInfo {
    id: string;
    description: string;
    duration: string;
    status: TaskStatus;
    error?: string;
}

