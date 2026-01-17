/**
 * Toast Options Interface
 */

import type { ToastVariant } from "./toast-variant.js";

export interface ToastOptions {
    title: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
}
