import type { PluginInput } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode/plugin";
import { AgentRegistry } from "../core/agents/agent-registry.js";
import { SessionDeletionUnavailableError } from "../shared/errors/session-deletion-unavailable.js";
import { isRecord } from "../shared/core/guards.js";

type Context = Plugin.Context;
type LegacyClient = PluginInput["client"];
type LegacyRequest = { path?: { id?: string; messageID?: string }; body?: Record<string, unknown> };
type LegacyMessage = { info: Record<string, unknown>; parts: Record<string, unknown>[] };

interface V2ClientBridge {
    client: LegacyClient;
    statuses: Map<string, string>;
}

export function createV2ClientBridge(context: Context): V2ClientBridge {
    const statuses = new Map<string, string>();
    const session = createSessionApi(context, statuses);
    const client = {
        session,
        tui: { showToast: async () => ({}) },
        app: { agents: async () => ({ data: await context.agent.list() }) },
    };
    return { client: client as unknown as LegacyClient, statuses };
}

function createSessionApi(context: Context, statuses: Map<string, string>) {
    return {
        create: async (request: LegacyRequest) => wrap(await context.session.create({
            parentID: readString(request.body?.parentID),
            title: readString(request.body?.title),
        })),
        prompt: async (request: LegacyRequest) => prompt(context, request),
        abort: async (request: LegacyRequest) => wrap((await context.session.interrupt({
            sessionID: requireSessionID(request),
            resume: false,
        })).interrupted),
        delete: async (request: LegacyRequest) => {
            const sessionID = requireSessionID(request);
            // `session.remove` arrived in @opencode/plugin 2.0.22; older hosts
            // pass a context without it even though the types declare it.
            if (typeof context.session.remove !== "function") throw new SessionDeletionUnavailableError();
            await context.session.remove({ sessionID });
            return wrap(true);
        },
        messages: async (request: LegacyRequest) => wrap(mapMessages(
            await context.session.context({ sessionID: requireSessionID(request) }),
        )),
        message: async (request: LegacyRequest) => wrap(findMessage(
            await context.session.context({ sessionID: requireSessionID(request) }),
            request.path?.messageID,
        )),
        status: async () => wrap(Object.fromEntries(
            [...statuses].map(([id, type]) => [id, { type }]),
        )),
    };
}

async function prompt(context: Context, request: LegacyRequest): Promise<{ data: unknown }> {
    const sessionID = requireSessionID(request);
    const agent = readString(request.body?.agent);
    if (agent) await context.session.switchAgent({ sessionID, agent });
    const text = await addAgentRole(readPromptText(request.body), agent);
    const synthetic = readSynthetic(request.body);
    const resume = request.body?.noReply !== true;
    if (synthetic) {
        return wrap(await context.session.synthetic({ sessionID, text, resume }));
    }
    return wrap(await context.session.prompt({ sessionID, text, resume }));
}

async function addAgentRole(text: string, agent: string | undefined): Promise<string> {
    if (!agent) return text;
    const registry = AgentRegistry.getInstance();
    await registry.ready();
    const definition = registry.getAgent(agent);
    if (!definition) return text;
    return `### AGENT ROLE: ${definition.id}\n${definition.description}\n\n${definition.systemPrompt}\n\n${text}`;
}

function mapMessages(messages: readonly unknown[]): LegacyMessage[] {
    return messages.filter(isRecord).map(mapMessage);
}

function mapMessage(message: Record<string, unknown>): LegacyMessage {
    const role = message.type === "assistant" ? "assistant" : "user";
    const parts = Array.isArray(message.content)
        ? message.content.filter(isRecord)
        : [{ type: "text", text: readString(message.text) ?? "" }];
    return {
        info: {
            id: message.id,
            role,
            time: message.time,
            error: message.error,
            finish: message.finish,
            tokens: message.tokens,
            providerID: readNestedString(message, "model", "providerID"),
            modelID: readNestedString(message, "model", "id"),
        },
        parts,
    };
}

function findMessage(messages: readonly unknown[], messageID: string | undefined): LegacyMessage {
    const match = messages.filter(isRecord).find(message => message.id === messageID);
    return match ? mapMessage(match) : { info: {}, parts: [] };
}

function readPromptText(body: Record<string, unknown> | undefined): string {
    const parts = body?.parts;
    if (!Array.isArray(parts)) return "";
    return parts.filter(isRecord).map(part => readString(part.text) ?? "").join("\n");
}

function readSynthetic(body: Record<string, unknown> | undefined): boolean {
    const parts = body?.parts;
    return Array.isArray(parts) && parts.some(part => isRecord(part) && part.synthetic === true);
}

function requireSessionID(request: LegacyRequest): string {
    const sessionID = request.path?.id;
    if (!sessionID) throw new Error("OpenCode session ID is required");
    return sessionID;
}

function readNestedString(value: Record<string, unknown>, key: string, nested: string): string | undefined {
    const child = value[key];
    return isRecord(child) ? readString(child[nested]) : undefined;
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function wrap<T>(data: T): { data: T } {
    return { data };
}
