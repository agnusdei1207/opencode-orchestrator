/**
 * Chat Message Handler
 * 
 * Handles chat.message hook:
 * - Intercepting commands
 * - Setting up sessions
 * - Auto-applying mission mode for Commander
 */

import { log } from "../core/agents/logger.js";
import { PART_TYPES } from "../shared/index.js";
import { HookRegistry } from "../hooks/registry.js"; // Added import
import { HOOK_ACTIONS } from "../hooks/constants.js";
import type { ChatMessageHandlerContext } from "./interfaces/chat-message-context.js";
import type { SessionState } from "./interfaces/session-state.js";

// Redefine based on actual hook input seen in validation
type ChatHookInput = {
    sessionID: string;
    agent?: string;
    model?: { providerID: string; modelID: string };
    messageID?: string;
    variant?: string;
};

type ChatHookOutput = {
    parts: Array<{ type: string; text?: string }>;
};

/**
 * Create chat.message handler
 */
export function createChatMessageHandler(ctx: ChatMessageHandlerContext) {
    const { directory, sessions } = ctx;

    return async (msgInput: ChatHookInput, msgOutput: ChatHookOutput) => {
        const parts = msgOutput.parts;
        const textPartIndex = parts.findIndex(p => p.type === PART_TYPES.TEXT && p.text);
        if (textPartIndex === -1) return;

        const originalText = parts[textPartIndex].text || "";
        const sessionID = msgInput.sessionID;
        const agentName = (msgInput.agent || "").toLowerCase();

        log("[chat-message-handler] hook triggered", { sessionID, agent: agentName, textLength: originalText.length });
        markUserMessage(sessions, sessionID);

        // Execute Chat Hooks
        const hooks = HookRegistry.getInstance();
        const hookContext = {
            sessionID,
            directory,
            sessions: sessions as Map<string, unknown>
        };

        const hookResult = await hooks.executeChat(hookContext, originalText);

        if (hookResult.action === HOOK_ACTIONS.INTERCEPT) {
            parts.splice(0, parts.length);
            return;
        }

        if (hookResult.modifiedMessage) {
            parts[textPartIndex].text = hookResult.modifiedMessage;
        }
    };
}

function markUserMessage(sessions: Map<string, SessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (!session) return;

    session.lastUserMessageAt = Date.now();
}
