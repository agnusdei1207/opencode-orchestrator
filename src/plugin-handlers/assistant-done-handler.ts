/**
 * Plugin Handlers - Assistant Done Handler
 * 
 * Handles completed assistant turns using supported OpenCode session APIs.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { PART_TYPES } from "../shared/index.js";
import { HookRegistry } from "../hooks/registry.js";
import type { AssistantDoneHandlerContext } from "./interfaces/assistant-done-context.js";

type OpencodeClient = PluginInput["client"];
type AssistantMessagePart = { type: string; text?: string };

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
        });
        const parts = extractMessageParts(response);

        return parts
            .filter(part => part.type === PART_TYPES.TEXT || part.type === PART_TYPES.REASONING)
            .map(part => part.text ?? "")
            .join("\n");
    } catch (error) {
        log("[assistant-done-handler] Failed to read assistant message", { sessionID, messageID, error });
        return "";
    }
}

function extractMessageParts(response: unknown): AssistantMessagePart[] {
    if (!isRecord(response)) return [];

    const data = response.data;
    if (!isRecord(data) || !Array.isArray(data.parts)) return [];
    return data.parts.filter(isMessagePart);
}

function isMessagePart(value: unknown): value is AssistantMessagePart {
    return isRecord(value) && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
