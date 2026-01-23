/**
 * Plugin System Interfaces
 */

import type { ToolDefinition } from "@opencode-ai/plugin";
import type {
    PreToolUseHook,
    PostToolUseHook,
    ChatMessageHook,
    AssistantDoneHook
} from "../../hooks/types.js";

export interface CustomPlugin {
    name: string;
    version: string;
    description?: string;

    /**
     * Tools to register
     */
    tools?: Record<string, ToolDefinition>;

    /**
     * Hooks to register
     */
    hooks?: {
        preTool?: PreToolUseHook;
        postTool?: PostToolUseHook;
        chat?: ChatMessageHook;
        done?: AssistantDoneHook;
    };

    /**
     * Initialization logic
     */
    init?: (context: PluginContext) => Promise<void>;
}

export interface PluginContext {
    directory: string;
    // Add other useful references if needed
}
