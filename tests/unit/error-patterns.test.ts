/**
 * Error Patterns Tests
 */

import { describe, it, expect } from "vitest";
import {
    ERROR_PATTERNS,
    detectErrorType,
    isRetryableError,
    shouldAbortOnError,
    getRetryDelay,
} from "../../src/shared/errors/index.js";

describe("Error Patterns", () => {
    describe("ERROR_PATTERNS", () => {
        it("should have all expected patterns", () => {
            expect(ERROR_PATTERNS.TOOL_RESULT_MISSING).toBeDefined();
            expect(ERROR_PATTERNS.THINKING_BLOCK_ORDER).toBeDefined();
            expect(ERROR_PATTERNS.THINKING_DISABLED).toBeDefined();
            expect(ERROR_PATTERNS.RATE_LIMIT).toBeDefined();
            expect(ERROR_PATTERNS.CONTEXT_OVERFLOW).toBeDefined();
            expect(ERROR_PATTERNS.MESSAGE_ABORTED).toBeDefined();
            expect(ERROR_PATTERNS.NETWORK_ERROR).toBeDefined();
            expect(ERROR_PATTERNS.AUTH_ERROR).toBeDefined();
        });
    });

    describe("detectErrorType", () => {
        it("should detect tool_result_missing", () => {
            expect(detectErrorType("tool_result_missing")).toBe("TOOL_RESULT_MISSING");
            expect(detectErrorType("tool result is missing")).toBe("TOOL_RESULT_MISSING");
        });

        it("should detect rate_limit", () => {
            expect(detectErrorType("rate limit exceeded")).toBe("RATE_LIMIT");
            expect(detectErrorType("429 Too Many Requests")).toBe("RATE_LIMIT");
            expect(detectErrorType("too many requests")).toBe("RATE_LIMIT");
        });

        it("should detect thinking_block_order", () => {
            expect(detectErrorType("thinking_block_order")).toBe("THINKING_BLOCK_ORDER");
            expect(detectErrorType("thinking block order issue")).toBe("THINKING_BLOCK_ORDER");
        });

        it("should detect context_overflow", () => {
            expect(detectErrorType("context length exceeded")).toBe("CONTEXT_OVERFLOW");
            expect(detectErrorType("maximum context reached")).toBe("CONTEXT_OVERFLOW");
            expect(detectErrorType("token limit")).toBe("CONTEXT_OVERFLOW");
        });

        it("should detect network_error", () => {
            expect(detectErrorType("ECONNREFUSED")).toBe("NETWORK_ERROR");
            expect(detectErrorType("ETIMEDOUT")).toBe("NETWORK_ERROR");
            expect(detectErrorType("network error")).toBe("NETWORK_ERROR");
            expect(detectErrorType("fetch failed")).toBe("NETWORK_ERROR");
        });

        it("should detect auth_error", () => {
            expect(detectErrorType("401 Unauthorized")).toBe("AUTH_ERROR");
            expect(detectErrorType("403 Forbidden")).toBe("AUTH_ERROR");
            expect(detectErrorType("invalid token")).toBe("AUTH_ERROR");
        });

        it("should detect message_aborted", () => {
            expect(detectErrorType("MessageAbortedError")).toBe("MESSAGE_ABORTED");
            expect(detectErrorType("AbortError")).toBe("MESSAGE_ABORTED");
        });

        it("should return null for unknown errors", () => {
            expect(detectErrorType("random error")).toBeNull();
            expect(detectErrorType("something went wrong")).toBeNull();
        });

        it("should handle Error objects", () => {
            expect(detectErrorType(new Error("rate limit"))).toBe("RATE_LIMIT");
            expect(detectErrorType({ message: "tool_result_missing" })).toBe("TOOL_RESULT_MISSING");
        });
    });

    describe("isRetryableError", () => {
        it("should return true for retryable errors", () => {
            expect(isRetryableError("TOOL_RESULT_MISSING")).toBe(true);
            expect(isRetryableError("RATE_LIMIT")).toBe(true);
            expect(isRetryableError("NETWORK_ERROR")).toBe(true);
            expect(isRetryableError("THINKING_BLOCK_ORDER")).toBe(true);
        });

        it("should return false for non-retryable errors", () => {
            expect(isRetryableError("CONTEXT_OVERFLOW")).toBe(false);
            expect(isRetryableError("MESSAGE_ABORTED")).toBe(false);
            expect(isRetryableError("AUTH_ERROR")).toBe(false);
            expect(isRetryableError(null)).toBe(false);
        });
    });

    describe("shouldAbortOnError", () => {
        it("should return true for abort errors", () => {
            expect(shouldAbortOnError("MESSAGE_ABORTED")).toBe(true);
            expect(shouldAbortOnError("AUTH_ERROR")).toBe(true);
        });

        it("should return false for recoverable errors", () => {
            expect(shouldAbortOnError("RATE_LIMIT")).toBe(false);
            expect(shouldAbortOnError("TOOL_RESULT_MISSING")).toBe(false);
            expect(shouldAbortOnError(null)).toBe(false);
        });
    });

    describe("getRetryDelay", () => {
        it("should return longer delay for rate limit", () => {
            const delay1 = getRetryDelay("RATE_LIMIT", 1);
            const delay2 = getRetryDelay("RATE_LIMIT", 2);

            expect(delay1).toBe(5000); // 1s * 1 * 5
            expect(delay2).toBe(10000); // 1s * 2 * 5
        });

        it("should return medium delay for network errors", () => {
            const delay1 = getRetryDelay("NETWORK_ERROR", 1);
            const delay2 = getRetryDelay("NETWORK_ERROR", 2);

            expect(delay1).toBe(2000); // 1s * 1 * 2
            expect(delay2).toBe(4000); // 1s * 2 * 2
        });

        it("should return base delay for other errors", () => {
            const delay1 = getRetryDelay("TOOL_RESULT_MISSING", 1);
            const delay2 = getRetryDelay("TOOL_RESULT_MISSING", 2);

            expect(delay1).toBe(1000); // 1s * 1
            expect(delay2).toBe(2000); // 1s * 2
        });

        it("should cap multiplier at 5", () => {
            const delay10 = getRetryDelay("RATE_LIMIT", 10);
            expect(delay10).toBe(25000); // 1s * 5 * 5 (capped at 5)
        });
    });
});
