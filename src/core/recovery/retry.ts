/**
 * Session Retry Utilities
 * 
 * Provides sophisticated retry logic for API errors including:
 * - retry-after header parsing
 * - Exponential backoff
 * - Retryable error detection
 * 
 * Inspired by OpenCode's SessionRetry system.
 */

// ============================================================================
// Constants
// ============================================================================

/** Initial delay for retries (ms) */
export const RETRY_INITIAL_DELAY = 2000;

/** Backoff multiplier */
export const RETRY_BACKOFF_FACTOR = 2;

/** Max delay when no headers (30 seconds) */
export const RETRY_MAX_DELAY_NO_HEADERS = 30_000;

/** Absolute max delay for setTimeout (max 32-bit signed int) */
export const RETRY_MAX_DELAY = 2_147_483_647;

/** Max retry attempts */
export const MAX_RETRY_ATTEMPTS = 5;

// ============================================================================
// Types
// ============================================================================

export interface APIErrorData {
    isRetryable?: boolean;
    message?: string;
    responseHeaders?: Record<string, string>;
    status?: number;
}

export interface RetryConfig {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Sleep with abort signal support
 */
export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (signal) {
                signal.removeEventListener("abort", abortHandler);
            }
            resolve();
        }, Math.min(ms, RETRY_MAX_DELAY));

        const abortHandler = () => {
            clearTimeout(timeout);
            reject(new DOMException("Aborted", "AbortError"));
        };

        if (signal) {
            signal.addEventListener("abort", abortHandler, { once: true });
        }
    });
}

/**
 * Calculate retry delay from attempt number and optional error data
 * 
 * Priority:
 * 1. retry-after-ms header
 * 2. retry-after header (seconds or HTTP date)
 * 3. Exponential backoff
 */
export function calculateDelay(attempt: number, errorData?: APIErrorData): number {
    if (errorData?.responseHeaders) {
        const headers = errorData.responseHeaders;

        // Check retry-after-ms (milliseconds)
        const retryAfterMs = headers["retry-after-ms"];
        if (retryAfterMs) {
            const parsedMs = Number.parseFloat(retryAfterMs);
            if (!Number.isNaN(parsedMs)) {
                return parsedMs;
            }
        }

        // Check retry-after (seconds or HTTP date)
        const retryAfter = headers["retry-after"];
        if (retryAfter) {
            // Try parsing as seconds
            const parsedSeconds = Number.parseFloat(retryAfter);
            if (!Number.isNaN(parsedSeconds)) {
                return Math.ceil(parsedSeconds * 1000);
            }

            // Try parsing as HTTP date
            const parsed = Date.parse(retryAfter) - Date.now();
            if (!Number.isNaN(parsed) && parsed > 0) {
                return Math.ceil(parsed);
            }
        }

        // Has headers but no retry-after, use exponential backoff
        return RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1);
    }

    // No headers, use capped exponential backoff
    return Math.min(
        RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1),
        RETRY_MAX_DELAY_NO_HEADERS
    );
}

/**
 * Check if an error is retryable
 * 
 * Returns a human-readable reason if retryable, undefined otherwise.
 */
export function isRetryable(error: unknown): string | undefined {
    // Check if error has retryable flag
    if (typeof error === "object" && error !== null) {
        const errorObj = error as Record<string, unknown>;

        // Direct isRetryable flag
        if (errorObj.isRetryable === true) {
            const message = String(errorObj.message || "");
            return message.includes("Overloaded") ? "Provider is overloaded" : message;
        }

        // Check nested data
        if (typeof errorObj.data === "object" && errorObj.data !== null) {
            const data = errorObj.data as Record<string, unknown>;
            if (data.isRetryable === true) {
                const message = String(data.message || "");
                return message.includes("Overloaded") ? "Provider is overloaded" : message;
            }
        }

        // Try parsing message as JSON
        const message = String(errorObj.message || "");
        try {
            const json = JSON.parse(message);

            if (json.type === "error" && json.error?.type === "too_many_requests") {
                return "Too Many Requests";
            }

            if (json.code?.includes?.("exhausted") || json.code?.includes?.("unavailable")) {
                return "Provider is overloaded";
            }

            if (json.type === "error" && json.error?.code?.includes?.("rate_limit")) {
                return "Rate Limited";
            }

            if (
                json.error?.message?.includes?.("no_kv_space") ||
                (json.type === "error" && json.error?.type === "server_error") ||
                !!json.error
            ) {
                return "Provider Server Error";
            }
        } catch {
            // Not JSON, check raw message
            if (message.includes("rate") && message.includes("limit")) {
                return "Rate Limited";
            }
            if (message.includes("overloaded") || message.includes("503")) {
                return "Provider is overloaded";
            }
            if (message.includes("timeout")) {
                return "Request Timeout";
            }
        }
    }

    return undefined;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {},
    signal?: AbortSignal
): Promise<T> {
    const maxAttempts = config.maxAttempts ?? MAX_RETRY_ATTEMPTS;
    const initialDelay = config.initialDelay ?? RETRY_INITIAL_DELAY;
    const maxDelay = config.maxDelay ?? RETRY_MAX_DELAY_NO_HEADERS;
    const backoffFactor = config.backoffFactor ?? RETRY_BACKOFF_FACTOR;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Check if retryable
            const retryReason = isRetryable(error);
            if (!retryReason) {
                throw error;
            }

            // Last attempt, throw
            if (attempt >= maxAttempts) {
                throw error;
            }

            // Calculate delay
            const delay = Math.min(
                initialDelay * Math.pow(backoffFactor, attempt - 1),
                maxDelay
            );

            // Wait before retry
            await sleep(delay, signal);
        }
    }

    throw lastError;
}

/**
 * Format delay for human readability
 */
export function formatDelay(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
}
