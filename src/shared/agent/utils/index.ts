/**
 * Agent Utils Index
 */

import { STATUS_LABEL } from "../../core/constants/status-labels.js";

/**
 * Get a text-based status indicator (no emojis)
 */
export function getStatusIndicator(status: string): string {
    const statusMap: Record<string, string> = {
        pending: "[P]",
        running: "[R]",
        done: "[D]",
        completed: "[D]",
        success: "[+]",
        failed: "[-]",
        error: "[-]",
        cancelled: "[X]",
    };
    return statusMap[status.toLowerCase()] ?? "[?]";
}
