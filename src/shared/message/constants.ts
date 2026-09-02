/**
 * Message constants
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

export const PROMPTS = {
    CONTINUE: "continue",
    CONTINUE_PREVIOUS: "continue previous work",
    CONTINUE_DEFAULT: "continue from where we left off",
} as const;

/**
 * Command Names (without slash prefix, for comparison after parsing)
 */
export const COMMAND_NAMES = {
    TASK: "task",
    PLAN: "plan",
    STATUS: "status",
    STOP: "stop",
    CANCEL: "cancel",
} as const;

export type CommandName = (typeof COMMAND_NAMES)[keyof typeof COMMAND_NAMES];

/**
 * Plugin Hook Constants (OpenCode plugin hook names from @opencode-ai/plugin).
 */
export const PLUGIN_HOOKS = {
    /** Intercepts user messages before sending to LLM */
    CHAT_MESSAGE: "chat.message",
    /** Runs before every LLM call with the resolved model */
    CHAT_PARAMS: "chat.params",
    /** Runs before any tool call */
    TOOL_EXECUTE_BEFORE: "tool.execute.before",
    /** Runs after any tool call completes */
    TOOL_EXECUTE_AFTER: "tool.execute.after",
    /** Preserves custom compaction context */
    EXPERIMENTAL_SESSION_COMPACTING: "experimental.session.compacting",
    /** Injects dynamic system prompt additions */
    EXPERIMENTAL_CHAT_SYSTEM_TRANSFORM: "experimental.chat.system.transform",
} as const;

export type PluginHookName = (typeof PLUGIN_HOOKS)[keyof typeof PLUGIN_HOOKS];

/**
 * Message Role Constants (OpenCode message roles).
 */
export const MESSAGE_ROLES = {
    /** AI assistant message */
    ASSISTANT: "assistant",
    /** User message */
    USER: "user",
    /** System message */
    SYSTEM: "system",
} as const;

export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];

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
    RETRY: "retry",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
