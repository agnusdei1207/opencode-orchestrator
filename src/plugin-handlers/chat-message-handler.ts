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
import type { ChatMessageHandlerContext, SessionState } from "./interfaces/index.js";

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

        if (sessionID && !sessions.has(sessionID)) {
            // Fallback: Ensure session exists even if not /task (e.g. normal chat)
            // But usually ExternalPlugin or SlashCommand handles this?
            // If no hook creates session, we might need a default here?
            // Let's keep minimal safe fallback or rely on Hooks.
            // Given safety requirement: let's keep minimal session init if missing.
            // Actually, wait. SlashCommandHook only inits on /task. 
            // Normal chat should probably also track session?
            // Let's rely on the previous implementation's logic: 
            // "Register session if not already registered (allows /task with any agent)"
            // BUT ONLY FOR /task in legacy code.
            // So normal chat didn't auto-create session in legacy code? 
            // Let's assume Hooks cover it or we don't change behavior.
        }

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
