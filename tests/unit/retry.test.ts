/**
 * Retry Utilities Tests
 * 
 * Tests the session retry utility functions:
 * - calculateDelay with various scenarios
 * - isRetryable error detection
 * - withRetry higher-order function
 * - sleep with abort signal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    calculateDelay,
    isRetryable,
    withRetry,
    sleep,
    formatDelay,
    RETRY_INITIAL_DELAY,
    RETRY_BACKOFF_FACTOR,
    RETRY_MAX_DELAY_NO_HEADERS,
    MAX_RETRY_ATTEMPTS,
} from "../../src/core/recovery/retry";

describe("Retry Utilities", () => {
    describe("calculateDelay", () => {
        it("should calculate exponential backoff for first attempt", () => {
            const delay = calculateDelay(1);
            expect(delay).toBe(RETRY_INITIAL_DELAY);
        });

        it("should calculate exponential backoff for second attempt", () => {
            const delay = calculateDelay(2);
            expect(delay).toBe(RETRY_INITIAL_DELAY * RETRY_BACKOFF_FACTOR);
        });

        it("should cap delay at max when no headers", () => {
            const delay = calculateDelay(10);
            expect(delay).toBeLessThanOrEqual(RETRY_MAX_DELAY_NO_HEADERS);
        });

        it("should use retry-after-ms header when available", () => {
            const delay = calculateDelay(1, {
                responseHeaders: { "retry-after-ms": "5000" },
            });
            expect(delay).toBe(5000);
        });

        it("should use retry-after header in seconds", () => {
            const delay = calculateDelay(1, {
                responseHeaders: { "retry-after": "3" },
            });
            expect(delay).toBe(3000);
        });

        it("should parse retry-after as HTTP date", () => {
            const futureDate = new Date(Date.now() + 10000).toUTCString();
            const delay = calculateDelay(1, {
                responseHeaders: { "retry-after": futureDate },
            });
            expect(delay).toBeGreaterThan(9000);
            expect(delay).toBeLessThan(11000);
        });

        it("should fall back to exponential backoff when headers exist but no retry-after", () => {
            const delay = calculateDelay(2, {
                responseHeaders: { "x-custom": "value" },
            });
            expect(delay).toBe(RETRY_INITIAL_DELAY * RETRY_BACKOFF_FACTOR);
        });
    });

    describe("isRetryable", () => {
        it("should detect retryable errors with isRetryable flag", () => {
            const reason = isRetryable({ isRetryable: true, message: "Rate limited" });
            expect(reason).toBe("Rate limited");
        });

        it("should detect overloaded provider", () => {
            const reason = isRetryable({ isRetryable: true, message: "Overloaded" });
            expect(reason).toBe("Provider is overloaded");
        });

        it("should detect nested retryable errors", () => {
            const reason = isRetryable({ data: { isRetryable: true, message: "Retry me" } });
            expect(reason).toBe("Retry me");
        });

        it("should detect too_many_requests from JSON message", () => {
            const reason = isRetryable({
                message: JSON.stringify({ type: "error", error: { type: "too_many_requests" } }),
            });
            expect(reason).toBe("Too Many Requests");
        });

        it("should detect rate limit in plain message", () => {
            const reason = isRetryable({ message: "You hit the rate limit" });
            expect(reason).toBe("Rate Limited");
        });

        it("should detect overloaded from message", () => {
            const reason = isRetryable({ message: "Server overloaded, try again" });
            expect(reason).toBe("Provider is overloaded");
        });

        it("should return undefined for non-retryable errors", () => {
            const reason = isRetryable({ message: "Invalid parameter" });
            expect(reason).toBeUndefined();
        });

        it("should return undefined for null/undefined", () => {
            expect(isRetryable(null)).toBeUndefined();
            expect(isRetryable(undefined)).toBeUndefined();
        });
    });

    describe("sleep", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should resolve after specified time", async () => {
            const promise = sleep(1000);
            vi.advanceTimersByTime(1000);
            await expect(promise).resolves.toBeUndefined();
        });

        it("should reject when abort signal is triggered", async () => {
            const controller = new AbortController();
            const promise = sleep(10000, controller.signal);

            controller.abort();

            await expect(promise).rejects.toThrow("Aborted");
        });
    });

    describe("withRetry", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should return result on first success", async () => {
            const operation = vi.fn().mockResolvedValue("success");

            const resultPromise = withRetry(operation);
            const result = await resultPromise;

            expect(result).toBe("success");
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it("should retry on retryable error", async () => {
            const operation = vi.fn()
                .mockRejectedValueOnce({ message: "Rate limit exceeded", isRetryable: true })
                .mockResolvedValueOnce("success");

            const resultPromise = withRetry(operation);

            // First call fails
            await vi.advanceTimersByTimeAsync(0);

            // Wait for retry delay
            await vi.advanceTimersByTimeAsync(RETRY_INITIAL_DELAY);

            const result = await resultPromise;

            expect(result).toBe("success");
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it("should throw immediately on non-retryable error", async () => {
            const operation = vi.fn().mockRejectedValue({ message: "Invalid input" });

            await expect(withRetry(operation)).rejects.toEqual({ message: "Invalid input" });
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it("should respect max attempts", async () => {
            // Use real timers to avoid timing issues with fake timers
            vi.useRealTimers();

            const error = { message: "Always fails", isRetryable: true };
            let callCount = 0;
            const operation = async () => {
                callCount++;
                throw error;
            };

            try {
                await withRetry(operation, {
                    maxAttempts: 2,
                    initialDelay: 1,
                    maxDelay: 5,
                });
                expect.fail("Should have thrown");
            } catch (e) {
                expect(e).toEqual(error);
                expect(callCount).toBe(2);
            }
        });
    });

    describe("formatDelay", () => {
        it("should format milliseconds", () => {
            expect(formatDelay(500)).toBe("500ms");
        });

        it("should format seconds", () => {
            expect(formatDelay(5000)).toBe("5.0s");
        });

        it("should format minutes", () => {
            expect(formatDelay(120000)).toBe("2.0m");
        });
    });
});
