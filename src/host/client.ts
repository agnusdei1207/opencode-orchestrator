/**
 * The OpenCode 2 operations the orchestrator core needs, implemented directly
 * over the plugin context. The core depends on this interface only.
 */

import type { Plugin } from "@opencode/plugin";
import { SessionDeletionUnavailableError } from "../shared/errors/session-deletion-unavailable.js";
import { isRecord } from "../shared/core/guards.js";

type Context = Plugin.Context;

export interface HostMessage {
    id: string;
    role: "user" | "assistant";
    /** Epoch milliseconds when the message was created. */
    created?: number;
    /** Epoch milliseconds when an assistant message finished. */
    completed?: number;
    error?: unknown;
    /** Why an assistant turn ended, e.g. "stop" or "tool-calls". */
    finish?: string;
    /** Text and reasoning content joined by newlines. */
    text: string;
    toolCallCount: number;
}

export interface HostPrompt {
    sessionID: string;
    text: string;
    /** Switch the session to this agent before prompting. */
    agent?: string;
    /**
     * Orchestrator-authored text. The model reads it, but it is not shown as
     * the user's own input and does not name a new session.
     */
    synthetic?: boolean;
    /** Start a model turn after delivery. Defaults to true. */
    reply?: boolean;
}

export interface HostClient {
    createSession(input: { parentID?: string; title: string }): Promise<string>;
    prompt(input: HostPrompt): Promise<void>;
    /** Stop the session's current run. Resolves true when the host confirms. */
    interrupt(sessionID: string): Promise<boolean>;
    /** Throws SessionDeletionUnavailableError when the host cannot delete sessions. */
    removeSession(sessionID: string): Promise<void>;
    messages(sessionID: string): Promise<HostMessage[]>;
    /** Session ID → status for sessions the event stream reported as not idle. */
    statuses(): ReadonlyMap<string, string>;
    /** Context window the host configures for a model, when it reports one. */
    modelContextLimit(providerID: string, modelID: string): Promise<number | undefined>;
}

export interface HostClientBridge {
    client: HostClient;
    /** Written by the event bridge as execution starts and ends. */
    statuses: Map<string, string>;
}

export function createHostClient(context: Context): HostClientBridge {
    const statuses = new Map<string, string>();
    const client: HostClient = {
        createSession: async ({ parentID, title }) => (await context.session.create({ parentID, title })).id,
        prompt: async ({ sessionID, text, agent, synthetic, reply = true }) => {
            if (agent) await context.session.switchAgent({ sessionID, agent });
            if (synthetic) await context.session.synthetic({ sessionID, text, resume: reply });
            else await context.session.prompt({ sessionID, text, resume: reply });
        },
        interrupt: async sessionID => (await context.session.interrupt({ sessionID, resume: false })).interrupted,
        removeSession: async sessionID => {
            // `session.remove` arrived in @opencode/plugin 2.0.22; older hosts
            // pass a context without it even though the types declare it.
            if (typeof context.session.remove !== "function") throw new SessionDeletionUnavailableError();
            await context.session.remove({ sessionID });
        },
        messages: async sessionID => (await context.session.context({ sessionID })).filter(isRecord).map(toHostMessage),
        statuses: () => statuses,
        modelContextLimit: async (providerID, modelID) => {
            const listing = await context.model.list({ location: { directory: context.location.directory } });
            const model = listing.data.find(entry => entry.providerID === providerID && entry.id === modelID);
            return model?.limit.context;
        },
    };
    return { client, statuses };
}

function toHostMessage(message: Record<string, unknown>): HostMessage {
    const content = Array.isArray(message.content) ? message.content.filter(isRecord) : [];
    const time = isRecord(message.time) ? message.time : {};
    const text = content.length > 0
        ? content.filter(part => part.type === "text" || part.type === "reasoning")
            .map(part => readString(part.text) ?? "")
            .filter(Boolean)
            .join("\n")
        : readString(message.text) ?? "";
    return {
        id: readString(message.id) ?? "",
        role: message.type === "assistant" ? "assistant" : "user",
        created: readNumber(time.created),
        completed: readNumber(time.completed),
        error: message.error,
        finish: readString(message.finish),
        text,
        toolCallCount: content.filter(part => part.type === "tool").length,
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}
