/**
 * Chat Message Handler
 * 
 * Handles chat.message hook:
 * - Intercepting commands
 * - Setting up sessions
 * - Auto-applying mission mode for Commander
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { state } from "../core/orchestrator/index.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { detectSlashCommand } from "../utils/common.js";
import { AGENT_NAMES, PART_TYPES, PROMPTS, COMMAND_NAMES } from "../shared/index.js";
import * as Toast from "../core/notification/toast.js";
import * as ProgressTracker from "../core/progress/tracker.js";
import * as TodoContinuation from "../core/loop/todo-continuation.js";
import { startMissionLoop, readLoopState } from "../core/loop/mission-loop.js";
import { isMissionActive } from "../core/orchestrator/session-manager.js";
import { classifyIntent, setRouterDecision, isRouterEnabled } from "../core/router/intent-router.js";
import { HookRegistry } from "../hooks/registry.js"; // Added import
import { HOOK_ACTIONS } from "../hooks/constants.js";
import type { ChatMessageHandlerContext, SessionState } from "./interfaces/index.js";

export type { ChatMessageHandlerContext } from "./interfaces/index.js";

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
        const parsed = detectSlashCommand(originalText);
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

        // Intent router: classify the final (post-hook) turn so system-transform
        // injects only the context blocks it needs. Set here — after the intercept
        // check — so an intercepted command never leaves a stale decision behind.
        // Disabled, errored, or no decision → system-transform uses the FULL fallback.
        if (sessionID && isRouterEnabled()) {
            try {
                const finalText = parts[textPartIndex].text || originalText;
                const loopState = readLoopState(directory);
                const missionActive =
                    isMissionActive(sessionID, directory) ||
                    (loopState?.active === true && loopState.sessionID === sessionID);
                const decision = classifyIntent(finalText, {
                    missionActive,
                    sessionActive: sessions.get(sessionID)?.active === true,
                    isSlashCommand: finalText.trim().startsWith("/"),
                });
                setRouterDecision(sessionID, decision);
                log("[chat-message-handler] router decision", {
                    sessionID,
                    intent: decision.intent,
                    profile: decision.profile,
                    confidence: decision.confidence,
                    source: decision.source,
                });
            } catch (err) {
                // Never let routing break message handling; FULL fallback covers it.
                log("[chat-message-handler] router error", { sessionID, error: String(err) });
            }
        }
    };
}

function markUserMessage(sessions: Map<string, SessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (!session) return;

    session.lastUserMessageAt = Date.now();
}
