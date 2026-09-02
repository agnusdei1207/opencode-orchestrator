/**
 * Plugin Handlers - Assistant Done Handler
 *
 * Runs the internal done-hooks whenever an assistant message completes.
 *
 * Note that a completed assistant message marks the end of a *step*, not of the
 * turn: the upstream run loop finishes the message and then starts another step
 * whenever the model requested tool calls. Any prompt the hooks want to inject
 * is therefore queued (see `pending-injection`) and sent once the session
 * actually goes idle, instead of landing in the middle of ongoing work.
 */

import { PART_TYPES } from "../shared/index.js";
import { queuePrompts } from "../core/session/pending-injection.js";
import { recordAssistantTurn } from "../core/loop/circuit-breaker.js";
import { HookRegistry } from "../hooks/registry.js";
import { log } from "../core/agents/logger.js";
import type { AssistantDoneHandlerContext, OpencodeClient } from "./context.js";

type AssistantMessagePart = { type: string; text?: string };
type AssistantTurn = { text: string; toolCallCount: number };

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

    const turn = await readAssistantTurn(client, sessionID, messageID);
    session.lastCompletedMessageID = messageID;
    // Feed the loop detector before any hook can decide to continue the session.
    recordAssistantTurn(sessionID, turn.text, turn.toolCallCount);

    const result = await hooks.executeDone(
        { sessionID, agent: session.agent, directory, sessions },
        turn.text,
    );

    if (result.action !== "inject" || result.prompts.length === 0) {
        return;
    }

    const now = Date.now();
    session.step++;
    session.timestamp = now;
    session.lastStepTime = now;

    queuePrompts(sessionID, result.prompts);
    log("[assistant-done-handler] Queued continuation prompts for the next idle window", {
        sessionID,
        count: result.prompts.length,
        step: session.step,
    });
}

async function readAssistantTurn(
    client: OpencodeClient,
    sessionID: string,
    messageID: string,
): Promise<AssistantTurn> {
    try {
        const response = await client.session.message({
            path: { id: sessionID, messageID },
        });
        const parts = extractMessageParts(response);

        const text = parts
            .filter(part => part.type === PART_TYPES.TEXT || part.type === PART_TYPES.REASONING)
            .map(part => part.text ?? "")
            .join("\n");
        const toolCallCount = parts.filter(part => part.type === PART_TYPES.TOOL).length;
        return { text, toolCallCount };
    } catch (error) {
        log("[assistant-done-handler] Failed to read assistant message", { sessionID, messageID, error });
        return { text: "", toolCallCount: 0 };
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
