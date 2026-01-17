/**
 * Toast message with metadata
 */
import type { ToastVariant } from "../types/index.js";

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    variant: ToastVariant;
    timestamp: Date;
    duration: number;
    dismissed: boolean;
}
