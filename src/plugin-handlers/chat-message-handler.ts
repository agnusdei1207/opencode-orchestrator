/**
 * Plugin Handlers - Chat Message Handler
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
import { AGENT_NAMES, PART_TYPES, PROMPTS } from "../shared/constants.js";
import * as Toast from "../core/notification/toast.js";
import * as ProgressTracker from "../core/progress/tracker.js";
import * as TodoContinuation from "../core/loop/todo-continuation.js";
import { startMissionLoop } from "../core/loop/mission-seal.js";
import type { SessionState } from "./event-handler.js";

type OpencodeClient = PluginInput["client"];

export interface ChatMessageHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, SessionState>;
}

/**
 * Create chat.message handler
 */
export function createChatMessageHandler(ctx: ChatMessageHandlerContext) {
    const { directory, sessions } = ctx;

    return async (msgInput: any, msgOutput: any) => {
        const parts = msgOutput.parts as Array<{ type: string; text?: string }>;
        const textPartIndex = parts.findIndex(p => p.type === PART_TYPES.TEXT && p.text);
        if (textPartIndex === -1) return;

        const originalText = parts[textPartIndex].text || "";
        const parsed = detectSlashCommand(originalText);
        const sessionID = msgInput.sessionID;
        const agentName = (msgInput.agent || "").toLowerCase();

        log("[chat-message-handler] hook triggered", { sessionID, agent: agentName, textLength: originalText.length });

        // Cancel any pending todo continuation (user is interacting)
        if (sessionID) {
            TodoContinuation.handleUserMessage(sessionID);
        }

        // =========================================================================
        // Commander Auto-Mission Mode
        // When using Commander agent, ALWAYS apply mission mode template
        // =========================================================================
        if (agentName === AGENT_NAMES.COMMANDER) {
            // Initialize session if not exists
            if (!sessions.has(sessionID)) {
                const now = Date.now();
                sessions.set(sessionID, {
                    active: true,
                    step: 0,
                    timestamp: now,
                    startTime: now,
                    lastStepTime: now,
                });
                state.missionActive = true;
                state.sessions.set(sessionID, {
                    enabled: true,
                    iterations: 0,
                    taskRetries: new Map(),
                    currentTask: "",
                    anomalyCount: 0,
                });

                // Initialize progress tracking for this session
                ProgressTracker.startSession(sessionID);

                // Show task started notification
                Toast.presets.taskStarted(sessionID, AGENT_NAMES.COMMANDER);
            }

            // AUTO-APPLY mission mode template if not already a /task command
            if (!parsed || parsed.command !== "task") {
                const taskTemplate = COMMANDS["task"].template;
                const userMessage = parsed?.args || originalText;

                parts[textPartIndex].text = taskTemplate.replace(
                    /\$ARGUMENTS/g,
                    userMessage || PROMPTS.CONTINUE
                );

                // Start mission loop for non-/task Commander messages
                startMissionLoop(directory, sessionID, userMessage || originalText);
                log("[chat-message-handler] Auto-applied mission mode + started loop", { originalLength: originalText.length });
            }
        }

        // Handle explicit slash commands (for all agents)
        if (parsed) {
            const command = COMMANDS[parsed.command];
            if (command && agentName !== AGENT_NAMES.COMMANDER) {
                // Apply template for non-Commander agents
                parts[textPartIndex].text = command.template.replace(
                    /\$ARGUMENTS/g,
                    parsed.args || PROMPTS.CONTINUE
                );
            } else if (command && parsed.command === "task") {
                // Explicit /task on Commander: apply template and start mission loop
                parts[textPartIndex].text = command.template.replace(
                    /\$ARGUMENTS/g,
                    parsed.args || PROMPTS.CONTINUE
                );

                // Start mission loop for /task command
                startMissionLoop(directory, sessionID, parsed.args || "continue from where we left off");
                log("[chat-message-handler] /task command: started mission loop", { sessionID, args: parsed.args?.slice(0, 50) });
            }
        }
    };
}
