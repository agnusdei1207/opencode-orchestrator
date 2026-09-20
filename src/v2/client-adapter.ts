import type { PluginInput } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode/plugin";
import { AgentRegistry } from "../core/agents/agent-registry.js";

type Context = Plugin.Context;
type LegacyClient = PluginInput["client"];
type LegacyRequest = { path?: { id?: string; messageID?: string }; body?: Record<string, unknown> };
type LegacyMessage = { info: Record<string, unknown>; parts: Record<string, unknown>[] };

export interface V2ClientBridge {
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
            title: readString(request.body?.title),
        })),
        prompt: async (request: LegacyRequest) => prompt(context, request),
        abort: async (request: LegacyRequest) => wrap(await context.session.interrupt({
            sessionID: requireSessionID(request),
        })),
        delete: async (request: LegacyRequest) => wrap(await context.session.interrupt({
            sessionID: requireSessionID(request),
        })),
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
    const text = await addAgentRole(readPromptText(request.body), readString(request.body?.agent));
    const synthetic = readSynthetic(request.body);
    if (synthetic) {
        return wrap(await context.session.synthetic({ sessionID, text, resume: true }));
    }
    return wrap(await context.session.prompt({ sessionID, text, resume: true }));
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wrap<T>(data: T): { data: T } {
    return { data };
}
