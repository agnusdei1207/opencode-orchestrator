/**
 * Plugin Hook Constants
 * 
 * OpenCode plugin hook names (from @opencode-ai/plugin)
 * Use these instead of hardcoded strings
 */

export const PLUGIN_HOOKS = {
    /** Intercepts user messages before sending to LLM */
    CHAT_MESSAGE: "chat.message",
    /** Runs before any tool call */
    TOOL_EXECUTE_BEFORE: "tool.execute.before",
    /** Runs after any tool call completes */
    TOOL_EXECUTE_AFTER: "tool.execute.after",
    /** Preserves custom compaction context */
    EXPERIMENTAL_SESSION_COMPACTING: "experimental.session.compacting",
    /** Injects dynamic system prompt additions */
    EXPERIMENTAL_CHAT_SYSTEM_TRANSFORM: "experimental.chat.system.transform",
} as const;

export type PluginHookName = typeof PLUGIN_HOOKS[keyof typeof PLUGIN_HOOKS];
