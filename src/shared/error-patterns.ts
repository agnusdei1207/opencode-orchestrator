/**
 * Error Patterns - Common error detection patterns used across the system
 * 
 * These patterns are used by:
 * - SessionRecovery for automatic error handling
 * - Recovery handler for retry decisions
 * - Logging for error categorization
 */

/**
 * Error type detection patterns (from OpenCode sessions)
 */
export const ERROR_PATTERNS = {
    TOOL_RESULT_MISSING: /tool_result_missing|tool result.*missing/i,
    THINKING_BLOCK_ORDER: /thinking.*block.*order|thinking_block_order/i,
    THINKING_DISABLED: /thinking.*disabled|thinking_disabled_violation/i,
    RATE_LIMIT: /rate.?limit|too.?many.?requests|429/i,
    CONTEXT_OVERFLOW: /context.?length|token.?limit|maximum.?context/i,
    MESSAGE_ABORTED: /MessageAbortedError|AbortError/i,
    NETWORK_ERROR: /network|ECONNREFUSED|ETIMEDOUT|fetch failed/i,
    AUTH_ERROR: /unauthorized|401|403|invalid.*token/i,
} as const;

export type ErrorPatternType = keyof typeof ERROR_PATTERNS;

/**
 * Detect error type from error message or object
 */
export function detectErrorType(error: unknown): ErrorPatternType | null {
    const errorStr = typeof error === "string"
        ? error
        : (error as { message?: string; name?: string })?.message
        || (error as { message?: string; name?: string })?.name
        || String(error);

    for (const [type, pattern] of Object.entries(ERROR_PATTERNS)) {
        if (pattern.test(errorStr)) {
            return type as ErrorPatternType;
        }
    }
    return null;
}

/**
 * Check if error is retryable
 */
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

/**
 * Check if error should abort (no recovery)
 */
export function shouldAbortOnError(errorType: ErrorPatternType | null): boolean {
    if (!errorType) return false;

    const ABORT_ERRORS: ErrorPatternType[] = [
        "MESSAGE_ABORTED",
        "AUTH_ERROR",
    ];

    return ABORT_ERRORS.includes(errorType);
}

/**
 * Get recommended delay for retry (in ms)
 */
export function getRetryDelay(errorType: ErrorPatternType | null, attempt: number): number {
    const baseDelay = 1000;
    const multiplier = Math.min(attempt, 5);

    switch (errorType) {
        case "RATE_LIMIT":
            return baseDelay * multiplier * 5; // 5s, 10s, 15s...
        case "NETWORK_ERROR":
            return baseDelay * multiplier * 2; // 2s, 4s, 6s...
        default:
            return baseDelay * multiplier; // 1s, 2s, 3s...
    }
}
