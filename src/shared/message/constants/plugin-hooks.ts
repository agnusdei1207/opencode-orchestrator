/**
 * Plugin Hook Constants
 * 
 * OpenCode plugin hook names (from @opencode-ai/plugin)
 * Use these instead of hardcoded strings
 */

export const PLUGIN_HOOKS = {
    /** Intercepts user messages before sending to LLM */
    CHAT_MESSAGE: "chat.message",
    /** Runs after LLM finishes responding */
    ASSISTANT_DONE: "assistant.done",
    /** Runs after any tool call completes */
    TOOL_EXECUTE_AFTER: "tool.execute.after",
} as const;

export type PluginHookName = typeof PLUGIN_HOOKS[keyof typeof PLUGIN_HOOKS];
