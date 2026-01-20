/**
 * Error Type Constants
 */

import type { ErrorPatternType } from "../types/error-pattern-type.js";

export const ERROR_TYPE = {
    TOOL_RESULT_MISSING: "TOOL_RESULT_MISSING",
    THINKING_BLOCK_ORDER: "THINKING_BLOCK_ORDER",
    THINKING_DISABLED: "THINKING_DISABLED",
    RATE_LIMIT: "RATE_LIMIT",
    CONTEXT_OVERFLOW: "CONTEXT_OVERFLOW",
    MESSAGE_ABORTED: "MESSAGE_ABORTED",
    NETWORK_ERROR: "NETWORK_ERROR",
    AUTH_ERROR: "AUTH_ERROR",
} as const satisfies Record<ErrorPatternType, ErrorPatternType>;
