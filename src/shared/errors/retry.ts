/**
 * Error Retry Logic
 */

import type { ErrorPatternType } from "./patterns.js";

export function isRetryableError(errorType: ErrorPatternType | null): boolean {
    if (!errorType) return false;

    const RETRYABLE: ErrorPatternType[] = [
        "TOOL_RESULT_MISSING",
        "THINKING_BLOCK_ORDER",
        "THINKING_DISABLED",
        "RATE_LIMIT",
        "NETWORK_ERROR",
    ];

    return RETRYABLE.includes(errorType);
}

export function shouldAbortOnError(errorType: ErrorPatternType | null): boolean {
    if (!errorType) return false;

    const ABORT_ERRORS: ErrorPatternType[] = [
        "MESSAGE_ABORTED",
        "AUTH_ERROR",
    ];

    return ABORT_ERRORS.includes(errorType);
}

export function getRetryDelay(errorType: ErrorPatternType | null, attempt: number): number {
    const baseDelay = 1000;
    const multiplier = Math.min(attempt, 5);

    switch (errorType) {
        case "RATE_LIMIT":
            return baseDelay * multiplier * 5;
        case "NETWORK_ERROR":
            return baseDelay * multiplier * 2;
        default:
            return baseDelay * multiplier;
    }
}
