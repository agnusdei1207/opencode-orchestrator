import type { Plugin } from "@opencode/plugin";
import { log } from "../core/agents/logger.js";

type Context = Plugin.Context;
type LegacyHandler = (input: { event: LegacyEvent }) => Promise<void>;
type LegacyEvent = { type: string; properties: Record<string, unknown> };

export function startV2EventBridge(
    context: Context,
    handler: LegacyHandler,
    statuses: Map<string, string>,
): () => void {
    const controller = new AbortController();
    void consumeEvents(context, handler, statuses, controller.signal).catch(error => {
        if (!controller.signal.aborted) log(`[v2-event-bridge] Event stream failed: ${error}`);
    });
    return () => controller.abort();
}

async function consumeEvents(
    context: Context,
    handler: LegacyHandler,
    statuses: Map<string, string>,
    signal: AbortSignal,
): Promise<void> {
    for await (const event of context.event.subscribe({ signal })) {
        if (signal.aborted) return;
        for (const translated of translateEvents(event, statuses)) {
            await handler({ event: translated });
        }
    }
}

function translateEvents(event: unknown, statuses: Map<string, string>): LegacyEvent[] {
    if (!isRecord(event) || typeof event.type !== "string") return [];
    const data = isRecord(event.data) ? event.data : {};
    const sessionID = readSessionID(data);
    if (event.type === "session.execution.started") return statusEvent(statuses, sessionID, "busy");
    if (event.type === "session.execution.succeeded") return statusEvent(statuses, sessionID, "idle");
    if (event.type === "session.step.ended") return [messageEvent(data, sessionID, event.created)];
    if (PART_EVENTS.has(event.type)) {
        return [{ type: "message.part.updated", properties: { part: { ...data, sessionID } } }];
    }
    if (event.type === "session.execution.interrupted") {
        return [{ type: "session.error", properties: { ...data, sessionID, error: { name: "AbortError" } } }];
    }
    const type = EVENT_TYPES[event.type] ?? event.type;
    return [{ type, properties: { ...data, sessionID } }];
}

function statusEvent(statuses: Map<string, string>, sessionID: string, type: string): LegacyEvent[] {
    statuses.set(sessionID, type);
    return [{ type: "session.status", properties: { sessionID, status: { type } } }];
}

function messageEvent(data: Record<string, unknown>, sessionID: string, completed: unknown): LegacyEvent {
    return {
        type: "message.updated",
        properties: {
            info: {
                id: data.assistantMessageID,
                sessionID,
                role: "assistant",
                time: { completed: typeof completed === "number" ? completed : Date.now() },
                tokens: data.tokens,
            },
        },
    };
}

function readSessionID(data: Record<string, unknown>): string {
    if (typeof data.sessionID === "string") return data.sessionID;
    if (isRecord(data.session) && typeof data.session.id === "string") return data.session.id;
    return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EVENT_TYPES: Record<string, string> = {
    "session.compaction.ended": "session.compacted",
    "session.execution.failed": "session.error",
};

const PART_EVENTS = new Set([
    "session.text.ended",
    "session.reasoning.ended",
    "session.tool.success",
    "session.tool.failed",
]);
