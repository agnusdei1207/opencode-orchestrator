/**
 * Event Handler Context
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionState } from "./session-state.js";
import type { OrchestratorState } from "./orchestrator-state.js";
import type { SessionNotificationHandler } from "../../core/notification/os-notify/index.js";

type OpencodeClient = PluginInput["client"];

export interface EventHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, SessionState>;
    state: OrchestratorState;
    sessionNotifyHandler?: SessionNotificationHandler;
}

