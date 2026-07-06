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

interface ResolvedRetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

const RETRY_REASONS = {
    OVERLOADED: "Provider is overloaded",
    TOO_MANY_REQUESTS: "Too Many Requests",
    RATE_LIMITED: "Rate Limited",
    SERVER_ERROR: "Provider Server Error",
    TIMEOUT: "Request Timeout",
} as const;

const JSON_ERROR_TYPE = "error";
const JSON_TOO_MANY_REQUESTS = "too_many_requests";
const JSON_SERVER_ERROR = "server_error";
const NO_KV_SPACE = "no_kv_space";
const EXHAUSTED = "exhausted";
const UNAVAILABLE = "unavailable";
const RATE_LIMIT = "rate_limit";

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
    if (!isRecord(error)) return undefined;

    return retryableFlagReason(error)
        ?? retryableDataReason(error.data)
        ?? retryableMessageReason(readMessage(error));
}

function retryableFlagReason(error: Record<string, unknown>): string | undefined {
    return error.isRetryable === true ? formatRetryableFlagMessage(error.message) : undefined;
}

function retryableDataReason(data: unknown): string | undefined {
    if (!isRecord(data) || data.isRetryable !== true) return undefined;
    return formatRetryableFlagMessage(data.message);
}

function formatRetryableFlagMessage(value: unknown): string {
    const message = String(value || "");
    return message.includes("Overloaded") ? RETRY_REASONS.OVERLOADED : message;
}

function retryableMessageReason(message: string): string | undefined {
    try {
        return retryableJsonReason(JSON.parse(message));
    } catch {
        return retryableRawMessageReason(message);
    }
}

function retryableJsonReason(json: unknown): string | undefined {
    if (!isRecord(json)) return undefined;

    const error = json.error;
    return jsonTooManyRequestsReason(json, error)
        ?? jsonProviderCodeReason(json)
        ?? jsonRateLimitReason(json, error)
        ?? jsonServerErrorReason(json, error);
}

function jsonTooManyRequestsReason(json: Record<string, unknown>, error: unknown): string | undefined {
    if (json.type === JSON_ERROR_TYPE && isRecord(error) && error.type === JSON_TOO_MANY_REQUESTS) {
        return RETRY_REASONS.TOO_MANY_REQUESTS;
    }
    return undefined;
}

function jsonProviderCodeReason(json: Record<string, unknown>): string | undefined {
    if (valueIncludes(json.code, EXHAUSTED) || valueIncludes(json.code, UNAVAILABLE)) {
        return RETRY_REASONS.OVERLOADED;
    }
    return undefined;
}

function jsonRateLimitReason(json: Record<string, unknown>, error: unknown): string | undefined {
    if (json.type === JSON_ERROR_TYPE && isRecord(error) && valueIncludes(error.code, RATE_LIMIT)) {
        return RETRY_REASONS.RATE_LIMITED;
    }
    return undefined;
}

function jsonServerErrorReason(json: Record<string, unknown>, error: unknown): string | undefined {
    if (isProviderServerError(json, error)) {
        return RETRY_REASONS.SERVER_ERROR;
    }
    return undefined;
}

function isProviderServerError(json: Record<string, unknown>, error: unknown): boolean {
    return (isRecord(error) && valueIncludes(error.message, NO_KV_SPACE))
        || (json.type === JSON_ERROR_TYPE && isRecord(error) && error.type === JSON_SERVER_ERROR)
        || Boolean(error);
}

function retryableRawMessageReason(message: string): string | undefined {
    if (message.includes("rate") && message.includes("limit")) {
        return RETRY_REASONS.RATE_LIMITED;
    }
    if (message.includes("overloaded") || message.includes("503")) {
        return RETRY_REASONS.OVERLOADED;
    }
    if (message.includes("timeout")) {
        return RETRY_REASONS.TIMEOUT;
    }
    return undefined;
}

function readMessage(error: Record<string, unknown>): string {
    return String(error.message || "");
}

function valueIncludes(value: unknown, search: string): boolean {
    if (value === null || value === undefined) return false;
    const candidate = value as { includes?: (needle: string) => boolean };
    return candidate.includes?.(search) === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {},
    signal?: AbortSignal
): Promise<T> {
    const retryConfig = resolveRetryConfig(config);
    let lastError: unknown;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
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
            if (attempt >= retryConfig.maxAttempts) {
                throw error;
            }

            // Wait before retry
            await sleep(calculateRetryDelay(attempt, retryConfig), signal);
        }
    }

    throw lastError;
}

function resolveRetryConfig(config: RetryConfig): ResolvedRetryConfig {
    return {
        maxAttempts: config.maxAttempts ?? MAX_RETRY_ATTEMPTS,
        initialDelay: config.initialDelay ?? RETRY_INITIAL_DELAY,
        maxDelay: config.maxDelay ?? RETRY_MAX_DELAY_NO_HEADERS,
        backoffFactor: config.backoffFactor ?? RETRY_BACKOFF_FACTOR,
    };
}

function calculateRetryDelay(attempt: number, config: ResolvedRetryConfig): number {
    return Math.min(
        config.initialDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
    );
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
