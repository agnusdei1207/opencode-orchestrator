/**
 * Message constants
 */

export const PART_TYPES = {
    TEXT: "text",
    REASONING: "reasoning",
    /** Anthropic-style tool reference */
    TOOL: "tool",
    /** Anthropic-style tool invocation */
    TOOL_USE: "tool_use",
} as const;

export const PROMPTS = {
    CONTINUE: "continue",
    CONTINUE_DEFAULT: "continue from where we left off",
} as const;

/**
 * Command Names (without slash prefix, for comparison after parsing)
 */
export const COMMAND_NAMES = {
    TASK: "task",
    STOP: "stop",
    CANCEL: "cancel",
} as const;

/**
 * Message Role Constants (OpenCode message roles).
 */
export const MESSAGE_ROLES = {
    /** AI assistant message */
    ASSISTANT: "assistant",
    /** User message */
    USER: "user",
} as const;

/**
 * Session Status Types.
 *
 * Mirrors the upstream `SessionStatus` union (`idle` | `busy` | `retry`).
 * Anything other than `idle` means the session is still working, so it must not
 * be interrupted with an injected prompt.
 */
export const SESSION_STATUS = {
    IDLE: "idle",
    BUSY: "busy",
} as const;
