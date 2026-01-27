/**
 * Message Constants
 */

export const MESSAGE_ROLES = {
    SYSTEM: "system",
    USER: "user",
    ASSISTANT: "assistant",
} as const;

export const PART_TYPES = {
    TEXT: "text",
    TOOL: "tool",
    REASONING: "reasoning",
    IMAGE: "image",
    TOOL_USE: "tool_use",
} as const;
