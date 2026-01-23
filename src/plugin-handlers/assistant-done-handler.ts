/**
 * Plugin Handlers - Assistant Done Handler
 * 
 * Handles assistant.done hook:
 * - Delegates to HookRegistry
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { PART_TYPES } from "../shared/index.js";
import { formatTimestamp, formatElapsedTime } from "../utils/common.js";
import { HookRegistry } from "../hooks/registry.js";
import type { SessionState } from "./event-handler.js";

import type { AssistantDoneHandlerContext } from "./interfaces/index.js";

type OpencodeClient = PluginInput["client"];

export type { AssistantDoneHandlerContext } from "./interfaces/index.js";

/**
 * Create assistant.done handler
 */
export function createAssistantDoneHandler(ctx: AssistantDoneHandlerContext) {
    const { client, directory, sessions } = ctx;
    const hooks = HookRegistry.getInstance();

    return async (assistantInput: any, assistantOutput: any) => {
        const sessionID = assistantInput.sessionID;
        const session = sessions.get(sessionID);

        if (!session?.active) return;

        // Gather all the text from the response
        const parts = assistantOutput.parts as Array<{ type: string; text?: string }> | undefined;
        const textContent = parts
            ?.filter((p: any) => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
            .map((p: any) => p.text || "")
            .join("\n") || "";

        // Execute Hooks
        // HookContext needs to match what logic expects. 
        // Logic (Sanity/MissionLoop) needs sessionID, and access to state/directory/sessions.
        // We defined HookContext to include directory and sessions.

        const hookContext = {
            sessionID,
            directory,
            sessions: sessions as Map<string, any> // Cast because types might slightly differ in strict mode, but it's the same object
        };

        const result = await hooks.executeDone(hookContext, textContent);

        if (result.action === "stop") {
            // If hook says stop, we assume it handled the state cleanup
            return;
        }

        if (result.action === "inject" && result.prompts) {
            // Update session tracking
            const now = Date.now();
            session.step++;
            session.timestamp = now;
            session.lastStepTime = now;

            try {
                if (client?.session?.prompt) {
                    // Inject strings as text parts
                    const parts = result.prompts.map(p => ({
                        type: PART_TYPES.TEXT,
                        text: p
                    }));

                    // Fire and forget: Do NOT await this prompt call here.
                    // Awaiting here causes a recursive hook-await deadlock 
                    // because the server waits for this hook to finish before closing the turn,
                    // while this prompt call starts a new turn that would trigger another hook.
                    client.session.prompt({
                        path: { id: sessionID },
                        body: { parts },
                    }).catch(error => {
                        log("[assistant-done-handler] Failed to inject continuation prompts", { sessionID, error });
                    });
                }
            } catch (error) {
                log("[assistant-done-handler] Failed to inject continuation prompts", { sessionID, error });
            }
        }
    };
}
