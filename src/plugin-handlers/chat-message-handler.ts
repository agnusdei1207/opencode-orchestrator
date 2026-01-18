/**
 * Chat Message Handler
 * 
 * Handles chat.message hook:
 * - Intercepting commands
 * - Setting up sessions
 * - Auto-applying mission mode for Commander
 */

import { log } from "../core/agents/logger.js";
import { state } from "../core/orchestrator/index.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { detectSlashCommand } from "../utils/common.js";
import { AGENT_NAMES, PART_TYPES, PROMPTS } from "../shared/index.js";
import * as Toast from "../core/notification/toast.js";
import * as ProgressTracker from "../core/progress/tracker.js";
import * as TodoContinuation from "../core/loop/todo-continuation.js";
import { startMissionLoop } from "../core/loop/mission-seal.js";
import type { ChatMessageHandlerContext } from "./interfaces/index.js";

export type { ChatMessageHandlerContext } from "./interfaces/index.js";

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

        if (sessionID) {
            TodoContinuation.handleUserMessage(sessionID);
        }

        // Commander Auto-Mission Mode
        if (agentName === AGENT_NAMES.COMMANDER) {
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

                ProgressTracker.startSession(sessionID);
                Toast.presets.taskStarted(sessionID, AGENT_NAMES.COMMANDER);
            }

            if (!parsed || parsed.command !== "task") {
                const taskTemplate = COMMANDS["task"].template;
                const userMessage = parsed?.args || originalText;

                parts[textPartIndex].text = taskTemplate.replace(
                    /\$ARGUMENTS/g,
                    userMessage || PROMPTS.CONTINUE
                );

                startMissionLoop(directory, sessionID, userMessage || originalText);
                log("[chat-message-handler] Auto-applied mission mode + started loop", { originalLength: originalText.length });
            }
        }

        // Handle explicit slash commands (including /task for any agent)
        if (parsed) {
            const command = COMMANDS[parsed.command];
            if (command && agentName !== AGENT_NAMES.COMMANDER) {
                parts[textPartIndex].text = command.template.replace(
                    /\$ARGUMENTS/g,
                    parsed.args || PROMPTS.CONTINUE
                );
            }

            // /task command - register session and start loop regardless of agent
            if (command && parsed.command === "task") {
                // Register session if not already registered (allows /task with any agent)
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

                    ProgressTracker.startSession(sessionID);
                    log("[chat-message-handler] Session registered for /task command", { sessionID, agent: agentName });
                }

                parts[textPartIndex].text = command.template.replace(
                    /\$ARGUMENTS/g,
                    parsed.args || PROMPTS.CONTINUE
                );

                startMissionLoop(directory, sessionID, parsed.args || "continue from where we left off");
                log("[chat-message-handler] /task command: started mission loop", { sessionID, args: parsed.args?.slice(0, 50) });
            }
        }
    };
}
