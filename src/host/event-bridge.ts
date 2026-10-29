import type { Plugin } from "@opencode/plugin";
import { resolve } from "node:path";
import { log } from "../shared/logger.js";
import { SESSION_EVENTS } from "../shared/session/constants.js";
import { V2_EXECUTION_EVENTS } from "../shared/session/v2-constants.js";
import { SESSION_STATUS } from "../shared/message/constants.js";
import { isRecord } from "../shared/core/guards.js";

type Context = Plugin.Context;
type EventHandler = (input: { event: TranslatedEvent }) => Promise<void>;
type TranslatedEvent = { type: string; properties: Record<string, unknown> };

const RESUBSCRIBE_INITIAL_DELAY_MS = 1_000;
const RESUBSCRIBE_MAX_DELAY_MS = 30_000;

/**
 * Feed host events to the handler until the plugin is disposed. A stream that
 * ends or fails is resubscribed with backoff: without events, mission
 * continuation, abort handling and child-session tracking all stop.
 */
export function startEventBridge(
    context: Context,
    handler: EventHandler,
    statuses: Map<string, string>,
): () => void {
    const controller = new AbortController();
    void runSubscription(context, handler, statuses, controller.signal);
    return () => controller.abort();
}

async function runSubscription(
    context: Context,
    handler: EventHandler,
    statuses: Map<string, string>,
    signal: AbortSignal,
): Promise<void> {
    const ownership = createLocationFilter(normalizeDirectory(context.location.directory));
    let delay = RESUBSCRIBE_INITIAL_DELAY_MS;
    while (!signal.aborted) {
        try {
            for await (const event of context.event.subscribe({ signal })) {
                if (signal.aborted) return;
                delay = RESUBSCRIBE_INITIAL_DELAY_MS;
                if (!ownership.accepts(event)) continue;
                for (const translated of translateEvents(event, statuses)) {
                    await dispatch(handler, translated);
                }
            }
        } catch (error) {
            if (signal.aborted) return;
            log(`[event-bridge] Event stream failed: ${error}`);
        }
        // Statuses seen before the gap may be stale; the next events restore them.
        statuses.clear();
        await waitUnlessAborted(delay, signal);
        delay = Math.min(delay * 2, RESUBSCRIBE_MAX_DELAY_MS);
    }
}

function waitUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise(resolveWait => {
        const timer = setTimeout(done, ms);
        timer.unref?.();
        signal.addEventListener("abort", done, { once: true });
        function done(): void {
            clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolveWait();
        }
    });
}

// One failing handler must not end the stream.
async function dispatch(handler: EventHandler, event: TranslatedEvent): Promise<void> {
    try {
        await handler({ event });
    } catch (error) {
        log(`[event-bridge] Handler failed for ${event.type}: ${error}`);
    }
}

/**
 * The host streams events "across all server locations", and it runs one plugin
 * instance per location, so each instance handles only its own location's
 * events. Some session events carry no location (for example
 * `session.execution.succeeded`); they are attributed through sessions already
 * seen with a foreign location. Unattributed events still pass.
 */
function createLocationFilter(ownDirectory: string) {
    const foreignSessions = new Set<string>();
    return {
        accepts(event: unknown): boolean {
            if (!isRecord(event)) return true;
            const data = isRecord(event.data) ? event.data : {};
            const sessionID = readSessionID(data);
            const directory = readLocationDirectory(event.location) ?? readLocationDirectory(data.location);
            const deleted = event.type === SESSION_EVENTS.DELETED;
            if (directory === undefined) {
                const foreign = sessionID !== "" && foreignSessions.has(sessionID);
                if (deleted) foreignSessions.delete(sessionID);
                return !foreign;
            }
            const own = normalizeDirectory(directory) === ownDirectory;
            if (sessionID !== "") {
                if (own || deleted) foreignSessions.delete(sessionID);
                else foreignSessions.add(sessionID);
            }
            return own;
        },
    };
}

function readLocationDirectory(location: unknown): string | undefined {
    return isRecord(location) && typeof location.directory === "string" ? location.directory : undefined;
}

function normalizeDirectory(directory: string): string {
    const resolved = resolve(directory);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}


interface V2Event {
    type: string;
    event: Record<string, unknown>;
    data: Record<string, unknown>;
    sessionID: string;
    statuses: Map<string, string>;
}

type Translator = (input: V2Event) => TranslatedEvent[];

function translateEvents(event: unknown, statuses: Map<string, string>): TranslatedEvent[] {
    if (!isRecord(event) || typeof event.type !== "string") return [];
    const data = isRecord(event.data) ? event.data : {};
    const input: V2Event = { type: event.type, event, data, sessionID: readSessionID(data), statuses };
    const translate = TRANSLATORS.get(event.type) ?? passThroughEvent;
    return translate(input);
}

function passThroughEvent({ type: v2Type, data, sessionID }: V2Event): TranslatedEvent[] {
    const type = EVENT_TYPES[v2Type] ?? v2Type;
    return [{ type, properties: { ...data, sessionID } }];
}

function failedEvents({ type, data, sessionID, statuses }: V2Event): TranslatedEvent[] {
    return [
        { type, properties: { ...data, sessionID } },
        { type: "session.error", properties: { ...data, sessionID } },
        ...statusEvent(statuses, sessionID, SESSION_STATUS.IDLE),
    ];
}

function interruptedEvents({ type, data, sessionID, statuses }: V2Event): TranslatedEvent[] {
    return [
        { type, properties: { ...data, sessionID } },
        { type: "session.error", properties: { ...data, sessionID, error: { name: "AbortError" } } },
        ...statusEvent(statuses, sessionID, SESSION_STATUS.IDLE),
    ];
}

function deletedEvents(input: V2Event): TranslatedEvent[] {
    input.statuses.delete(input.sessionID);
    return passThroughEvent(input);
}

function statusEvent(statuses: Map<string, string>, sessionID: string, type: string): TranslatedEvent[] {
    if (type === SESSION_STATUS.IDLE) statuses.delete(sessionID);
    else statuses.set(sessionID, type);
    return [{ type: "session.status", properties: { sessionID, status: { type } } }];
}

function messageEvent(data: Record<string, unknown>, sessionID: string, completed: unknown): TranslatedEvent {
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

const EVENT_TYPES: Record<string, string> = {
    "session.compaction.ended": "session.compacted",
};

/** V2 events that need more than a renamed pass-through. */
const TRANSLATORS = new Map<string, Translator>([
    ["session.execution.started", ({ statuses, sessionID }) => statusEvent(statuses, sessionID, SESSION_STATUS.BUSY)],
    ["session.execution.succeeded", ({ statuses, sessionID }) => statusEvent(statuses, sessionID, SESSION_STATUS.IDLE)],
    [SESSION_EVENTS.DELETED, deletedEvents],
    [V2_EXECUTION_EVENTS.FAILED, failedEvents],
    ["session.step.ended", ({ data, sessionID, event }) => [messageEvent(data, sessionID, event.created)]],
    [V2_EXECUTION_EVENTS.INTERRUPTED, interruptedEvents],
]);
