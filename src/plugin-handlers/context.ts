/**
 * Plugin handler context shared by OpenCode hook handlers.
 */

import type { HostClient } from "../host/client.js";
import type { ChildSessions } from "../core/session/child-sessions.js";
import type { ContextLimitResolver } from "../core/context/context-limit-resolver.js";

export interface PluginSessionState {
    active: boolean;
    /** Agent that owns this session (lowercased), captured from the context hook. */
    agent?: string;
    step: number;
    startTime: number;
    lastStepTime: number;
    lastCompletedMessageID?: string;
    lastUserMessageAt?: number;
    lastAssistantCompletedAt?: number;
    lastAbortAt?: number;
    tokens: {
        totalInput: number;
        totalOutput: number;
    };
}

export interface PluginHandlerContext {
    client: HostClient;
    directory: string;
    sessions: Map<string, PluginSessionState>;
    /** Child sessions of native subagents, per parent, for this plugin instance. */
    children: ChildSessions;
    /** Model context windows as this instance's project configures them. */
    contextLimits: ContextLimitResolver;
}

export type AssistantDoneHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions"> & Partial<Pick<PluginHandlerContext, "contextLimits">>;
export type ChatMessageHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions" | "children">;
export type ToolExecuteHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions"> & Partial<Pick<PluginHandlerContext, "contextLimits">>;
