/**
 * Plugin handler context shared by OpenCode hook handlers.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionState as OrchestratorSessionState } from "../core/orchestrator/state.js";

export type OpencodeClient = PluginInput["client"];

export interface PluginSessionState {
    active: boolean;
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

export interface OrchestratorStateContext {
    missionActive: boolean;
    sessions: Map<string, OrchestratorSessionState>;
}

export interface PluginHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, PluginSessionState>;
    state: OrchestratorStateContext;
}

export type AssistantDoneHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions">;
export type ChatMessageHandlerContext = Pick<PluginHandlerContext, "client" | "directory" | "sessions">;
export type ToolExecuteHandlerContext = Pick<PluginHandlerContext, "directory" | "sessions">;
