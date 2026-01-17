/**
 * Toast Message Interface
 */

import type { ToastVariant } from "./toast-variant.js";

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    variant: ToastVariant;
    timestamp: Date;
    duration: number;
    dismissed: boolean;
}
