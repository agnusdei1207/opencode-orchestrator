/**
 * Toast display options
 */
import type { ToastVariant } from "../types/index.js";

export interface ToastOptions {
    title: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
}
