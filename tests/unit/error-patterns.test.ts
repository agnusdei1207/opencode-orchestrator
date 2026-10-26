/**
 * Error Patterns Tests
 */

import { describe, it, expect } from "vitest";
import {
    ERROR_PATTERNS,
    detectErrorType,
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

        it("reads the message nested in host NamedError data", () => {
            // OpenCode session.error carries NamedError.toObject(): { name, data: { message } }.
            expect(detectErrorType({
                name: "APIError",
                data: { message: "Rate limit reached for requests", statusCode: 429, isRetryable: true },
            })).toBe("RATE_LIMIT");
            expect(detectErrorType({
                name: "UnknownError",
                data: { message: "messages: tool_result_missing for tool_use id" },
            })).toBe("TOOL_RESULT_MISSING");
        });

        it("still detects host aborts by name", () => {
            expect(detectErrorType({ name: "MessageAbortedError", data: { message: "Aborted" } })).toBe("MESSAGE_ABORTED");
        });
    });
});
