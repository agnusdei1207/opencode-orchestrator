import type { Plugin } from "@opencode/plugin";
import { log } from "../core/agents/logger.js";
import { SESSION_EVENTS } from "../shared/session/constants.js";
import { V2_EXECUTION_EVENTS } from "../shared/session/v2-constants.js";
import { SESSION_STATUS } from "../shared/message/constants.js";

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
            await dispatch(handler, translated);
        }
    }
}

// The subscription has no restart path, so one failing handler must not end the stream.
async function dispatch(handler: LegacyHandler, event: LegacyEvent): Promise<void> {
    try {
        await handler({ event });
    } catch (error) {
        log(`[v2-event-bridge] Handler failed for ${event.type}: ${error}`);
    }
}

interface V2Event {
    type: string;
    event: Record<string, unknown>;
    data: Record<string, unknown>;
    sessionID: string;
    statuses: Map<string, string>;
}

type Translator = (input: V2Event) => LegacyEvent[];

function translateEvents(event: unknown, statuses: Map<string, string>): LegacyEvent[] {
    if (!isRecord(event) || typeof event.type !== "string") return [];
    const data = isRecord(event.data) ? event.data : {};
    const input: V2Event = { type: event.type, event, data, sessionID: readSessionID(data), statuses };
    const translate = TRANSLATORS.get(event.type) ?? (PART_EVENTS.has(event.type) ? partEvent : passThroughEvent);
    return translate(input);
}

function partEvent({ data, sessionID }: V2Event): LegacyEvent[] {
    return [{ type: "message.part.updated", properties: { part: { ...data, sessionID } } }];
}

function passThroughEvent({ type: v2Type, data, sessionID }: V2Event): LegacyEvent[] {
    const type = EVENT_TYPES[v2Type] ?? v2Type;
    return [{ type, properties: { ...data, sessionID } }];
}

function failedEvents({ type, data, sessionID, statuses }: V2Event): LegacyEvent[] {
    return [
        { type, properties: { ...data, sessionID } },
        { type: "session.error", properties: { ...data, sessionID } },
        ...statusEvent(statuses, sessionID, SESSION_STATUS.IDLE),
    ];
}

function interruptedEvents({ type, data, sessionID, statuses }: V2Event): LegacyEvent[] {
    return [
        { type, properties: { ...data, sessionID } },
        { type: "session.error", properties: { ...data, sessionID, error: { name: "AbortError" } } },
        ...statusEvent(statuses, sessionID, SESSION_STATUS.IDLE),
    ];
}

function deletedEvents(input: V2Event): LegacyEvent[] {
    input.statuses.delete(input.sessionID);
    return passThroughEvent(input);
}

function statusEvent(statuses: Map<string, string>, sessionID: string, type: string): LegacyEvent[] {
    if (type === SESSION_STATUS.IDLE) statuses.delete(sessionID);
    else statuses.set(sessionID, type);
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
};

const PART_EVENTS = new Set([
    "session.text.ended",
    "session.reasoning.ended",
    "session.tool.success",
    "session.tool.failed",
]);

/** V2 events that need more than a renamed pass-through. */
const TRANSLATORS = new Map<string, Translator>([
    ["session.execution.started", ({ statuses, sessionID }) => statusEvent(statuses, sessionID, SESSION_STATUS.BUSY)],
    ["session.execution.succeeded", ({ statuses, sessionID }) => statusEvent(statuses, sessionID, SESSION_STATUS.IDLE)],
    [SESSION_EVENTS.DELETED, deletedEvents],
    [V2_EXECUTION_EVENTS.FAILED, failedEvents],
    ["session.step.ended", ({ data, sessionID, event }) => [messageEvent(data, sessionID, event.created)]],
    [V2_EXECUTION_EVENTS.INTERRUPTED, interruptedEvents],
]);
