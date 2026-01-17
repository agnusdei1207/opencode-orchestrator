/**
 * Chat Message Handler Context
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionState } from "./session-state.js";

type OpencodeClient = PluginInput["client"];

export interface ChatMessageHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, SessionState>;
}
