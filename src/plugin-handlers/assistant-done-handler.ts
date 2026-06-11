/**
 * Plugin Handlers - Assistant Done Handler
 * 
 * Handles completed assistant turns using supported OpenCode session APIs.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { PART_TYPES } from "../shared/index.js";
import { HookRegistry } from "../hooks/registry.js";
import type { AssistantDoneHandlerContext } from "./interfaces/index.js";

type OpencodeClient = PluginInput["client"];

export type { AssistantDoneHandlerContext } from "./interfaces/index.js";

/**
 * Process a completed assistant turn and run internal done-hooks.
 */
export async function handleCompletedAssistantMessage(
    ctx: AssistantDoneHandlerContext,
    sessionID: string,
    messageID: string,
): Promise<void> {
    const { client, directory, sessions } = ctx;
    const hooks = HookRegistry.getInstance();
    const session = sessions.get(sessionID);

    if (!session?.active || session.lastCompletedMessageID === messageID) {
        return;
    }

    const textContent = await readAssistantText(client, sessionID, messageID);
    session.lastCompletedMessageID = messageID;

    const result = await hooks.executeDone(
        { sessionID, directory, sessions },
        textContent,
    );

    if (result.action !== "inject" || result.prompts.length === 0) {
        return;
    }

    const now = Date.now();
    session.step++;
    session.timestamp = now;
    session.lastStepTime = now;

    try {
        const parts = result.prompts.map(text => ({ type: PART_TYPES.TEXT, text }));
        client.session.prompt({
            path: { id: sessionID },
            body: { parts },
        }).catch(error => {
            log("[assistant-done-handler] Failed to inject continuation prompts", { sessionID, error });
        });
    } catch (error) {
        log("[assistant-done-handler] Failed to inject continuation prompts", { sessionID, error });
    }
}

async function readAssistantText(
    client: OpencodeClient,
    sessionID: string,
    messageID: string,
): Promise<string> {
    try {
        const response = await client.session.message({
            path: { id: sessionID, messageID },
        }) as { parts?: Array<{ type: string; text?: string }> };

        return (response.parts ?? [])
            .filter(part => part.type === PART_TYPES.TEXT || part.type === PART_TYPES.REASONING)
            .map(part => part.text ?? "")
            .join("\n");
    } catch (error) {
        log("[assistant-done-handler] Failed to read assistant message", { sessionID, messageID, error });
        return "";
    }
}
