/**
 * Plugin handler context shared by OpenCode hook handlers.
 */

import type { HostClient } from "../host/client.js";
import type { ParallelAgentManager } from "../core/agents/manager.js";
import type { ContextLimitResolver } from "../core/context/context-limit-resolver.js";

export interface PluginSessionState {
    active: boolean;
    /** Agent that owns this session (lowercased), captured from chat.message. */
    agent?: string;
    step: number;
    timestamp: number;
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
    /** Delegated-task manager owned by this plugin instance (one per served directory). */
    agents: ParallelAgentManager;
    /** Model context windows as this instance's project configures them. */
    contextLimits: ContextLimitResolver;
}

export type AssistantDoneHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions"> & Partial<Pick<PluginHandlerContext, "contextLimits">>;
export type ChatMessageHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions" | "agents">;
export type ToolExecuteHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions"> & Partial<Pick<PluginHandlerContext, "contextLimits">>;
