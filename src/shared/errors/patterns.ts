/**
 * Error Patterns
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
