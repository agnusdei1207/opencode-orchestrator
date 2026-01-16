/**
 * Toast Types
 */

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

export interface ToastOptions {
    title: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
}
