/**
 * Plugin handler context shared by OpenCode hook handlers.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionState as OrchestratorSessionState } from "../core/orchestrator/state.js";
import type { ParallelAgentManager } from "../core/agents/manager.js";
import type { ContextLimitResolver } from "../core/context/context-limit-resolver.js";

export type OpencodeClient = PluginInput["client"];

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
        estimatedCost: number;
    };
}

interface OrchestratorStateContext {
    sessions: Map<string, OrchestratorSessionState>;
}

export interface PluginHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, PluginSessionState>;
    state: OrchestratorStateContext;
    /** Delegated-task manager owned by this plugin instance (one per served directory). */
    agents: ParallelAgentManager;
    /** Model context windows as this instance's project configures them. */
    contextLimits: ContextLimitResolver;
}

export type AssistantDoneHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions"> & Partial<Pick<PluginHandlerContext, "contextLimits">>;
export type ChatMessageHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions" | "agents">;
export type ToolExecuteHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions"> & Partial<Pick<PluginHandlerContext, "contextLimits">>;
export type CommandHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions" | "agents">;
