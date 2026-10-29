/**
 * The OpenCode 2 operations the orchestrator core needs, implemented directly
 * over the plugin context. The core depends on this interface only.
 */

import type { Plugin } from "@opencode/plugin";
import { isRecord } from "../shared/core/guards.js";

type Context = Plugin.Context;

/** The parts of a stored message the core reads. */
interface HostMessage {
    id: string;
    /** Text and reasoning content joined by newlines. */
    text: string;
    toolCallCount: number;
}

export interface HostClient {
    /**
     * Send orchestrator-authored text and start a model turn. The model reads
     * it, but it is not shown as the user's own input.
     */
    prompt(input: { sessionID: string; text: string }): Promise<void>;
    /** Stop the session's current run. Resolves true when the host confirms. */
    interrupt(sessionID: string): Promise<boolean>;
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
        prompt: async ({ sessionID, text }) => {
            await context.session.synthetic({ sessionID, text, resume: true });
        },
        interrupt: async sessionID => (await context.session.interrupt({ sessionID, resume: false })).interrupted,
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
    const text = content.length > 0
        ? content.filter(part => part.type === "text" || part.type === "reasoning")
            .map(part => readString(part.text) ?? "")
            .filter(Boolean)
            .join("\n")
        : readString(message.text) ?? "";
    return {
        id: readString(message.id) ?? "",
        text,
        toolCallCount: content.filter(part => part.type === "tool").length,
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}
