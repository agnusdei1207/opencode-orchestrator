/**
 * Error Retry Logic
 */

import { ERROR_TYPE } from "./constants/error-type.js";
import type { ErrorPatternType } from "./types/error-pattern-type.js";

import { RECOVERY } from "../recovery/constants/recovery.js";

export function isRetryableError(errorType: ErrorPatternType | null): boolean {
    if (!errorType) return false;

    const RETRYABLE: ErrorPatternType[] = [
        ERROR_TYPE.TOOL_RESULT_MISSING,
        ERROR_TYPE.THINKING_BLOCK_ORDER,
        ERROR_TYPE.THINKING_DISABLED,
        ERROR_TYPE.RATE_LIMIT,
        ERROR_TYPE.NETWORK_ERROR,
    ];

    return RETRYABLE.includes(errorType);
}

export function shouldAbortOnError(errorType: ErrorPatternType | null): boolean {
    if (!errorType) return false;

    const ABORT_ERRORS: ErrorPatternType[] = [
        ERROR_TYPE.MESSAGE_ABORTED,
        ERROR_TYPE.AUTH_ERROR,
    ];

    return ABORT_ERRORS.includes(errorType);
}

export function getRetryDelay(errorType: ErrorPatternType | null, attempt: number): number {
    const baseDelay = RECOVERY.BASE_DELAY_MS;
    const multiplier = Math.min(attempt, RECOVERY.MAX_RETRY_MULTIPLIER);

    switch (errorType) {
        case ERROR_TYPE.RATE_LIMIT:
            return baseDelay * multiplier * 5;
        case ERROR_TYPE.NETWORK_ERROR:
            return baseDelay * multiplier * 2;
        default:
            return baseDelay * multiplier;
    }
}

