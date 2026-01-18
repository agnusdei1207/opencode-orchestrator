/**
 * Message Part Types
 */

export const PART_TYPES = {
    TEXT: "text",
    REASONING: "reasoning",
    TOOL_CALL: "tool_call",
    TOOL_RESULT: "tool_result",
    /** Anthropic-style tool reference */
    TOOL: "tool",
    /** Anthropic-style tool invocation */
    TOOL_USE: "tool_use",
} as const;
