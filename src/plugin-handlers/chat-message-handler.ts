/**
 * Chat Message Handler
 * 
 * Handles chat.message hook:
 * - Intercepting commands
 * - Setting up sessions
 * - Auto-applying mission mode for Commander
 */

import type { Hooks } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { PART_TYPES } from "../shared/index.js";
import { HookRegistry } from "../hooks/registry.js";
import { HOOK_ACTIONS } from "../hooks/constants.js";
import { clearCircuitState } from "../core/loop/circuit-breaker.js";
import type { ChatMessageHandlerContext, PluginSessionState } from "./context.js";

type ChatMessageHook = NonNullable<Hooks["chat.message"]>;
export type ChatMessageInput = Parameters<ChatMessageHook>[0];
export type ChatMessageOutput = Parameters<ChatMessageHook>[1];

/**
 * Create chat.message handler
 */
export function createChatMessageHandler(ctx: ChatMessageHandlerContext) {
    const { directory, sessions } = ctx;

    return async (msgInput: ChatMessageInput, msgOutput: ChatMessageOutput) => {
        const parts = msgOutput.parts;
        const textPartIndex = parts.findIndex(isTextPartWithText);
        if (textPartIndex === -1) return;

        const textPart = parts[textPartIndex];
        if (!isTextPartWithText(textPart)) return;

        const originalText = textPart.text;
        const sessionID = msgInput.sessionID;
        const agentName = (msgInput.agent || "").toLowerCase();

        log("[chat-message-handler] hook triggered", { sessionID, agent: agentName, textLength: originalText.length });
        markUserMessage(sessions, sessionID);
        // A real user message is new input; whatever loop the model was stuck
        // in no longer applies. Orchestrator prompts are synthetic and do not count.
        if (!isSyntheticPart(textPart)) {
            clearCircuitState(sessionID);
        }

        // Remember which agent owns this session so later phases (post-tool,
        // assistant-done) can attribute work without re-deriving it.
        if (agentName) {
            const session = sessions.get(sessionID);
            if (session) session.agent = agentName;
        }

        // Execute Chat Hooks
        const hooks = HookRegistry.getInstance();
        const hookContext = {
            sessionID,
            agent: agentName || undefined,
            directory,
            sessions: sessions as Map<string, unknown>
        };

        const hookResult = await hooks.executeChat(hookContext, originalText);

        if (hookResult.action === HOOK_ACTIONS.INTERCEPT) {
            parts.splice(0, parts.length);
            return;
        }

        if (hookResult.modifiedMessage) {
            textPart.text = hookResult.modifiedMessage;
        }
    };
}

type ChatMessagePart = ChatMessageOutput["parts"][number];
type ChatTextPart = ChatMessagePart & { text: string };

function isTextPartWithText(part: ChatMessagePart): part is ChatTextPart {
    return part.type === PART_TYPES.TEXT && "text" in part && typeof part.text === "string" && part.text.length > 0;
}

function isSyntheticPart(part: ChatMessagePart): boolean {
    return "synthetic" in part && part.synthetic === true;
}

function markUserMessage(sessions: Map<string, PluginSessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (!session) return;

    session.lastUserMessageAt = Date.now();
}
