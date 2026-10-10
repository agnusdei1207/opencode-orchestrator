import type { Plugin } from "@opencode/plugin";
import { registerAllTools } from "../tools/registry.js";
import { initializePluginRuntime, type PluginRuntime } from "../plugin-runtime.js";
import { createChatMessageHandler } from "../plugin-handlers/chat-message-handler.js";
import { createToolExecuteBeforeHandler } from "../plugin-handlers/tool-execute-pre-handler.js";
import { createToolExecuteAfterHandler } from "../plugin-handlers/tool-execute-handler.js";
import { createSessionCompactingHandler } from "../plugin-handlers/session-compacting-handler.js";
import { createSystemTransformHandler } from "../plugin-handlers/system-transform-handler.js";
import { createEventHandler } from "../plugin-handlers/event-handler.js";
import { createV2ClientBridge } from "./client-adapter.js";
import { startV2EventBridge } from "./event-bridge.js";
import { registerV2Tools } from "./tool-adapter.js";
import { registerV2Commands } from "./command-adapter.js";
import { registerV2Agents } from "./agent-adapter.js";
import { ContextLimitResolver } from "../core/context/context-limit-resolver.js";
import { parseAgentTemperatures } from "../core/config/options-schema.js";
import { isRecord } from "../shared/core/guards.js";
import { truncateOversizedMessageParts } from "../shared/message/message-guard.js";

type Context = Plugin.Context;
type Registration = Awaited<ReturnType<Context["tool"]["transform"]>>;

export async function setupV2(contextInput: unknown): Promise<() => Promise<void>> {
    const context = contextInput as Context;
    const bridge = createV2ClientBridge(context);
    const runtime = initializePluginRuntime({
        client: bridge.client,
        directory: context.location.directory,
    } as unknown as Parameters<typeof initializePluginRuntime>[0], context.options);
    const { handlerContext } = runtime;
    const registrations: Registration[] = [];
    let stopEvents: (() => void) | undefined;
    try {
        await registerHooks(context, handlerContext, parseAgentTemperatures(context.options.agentTemperatures), registrations);
        registrations.push(await registerV2Agents(context));
        registrations.push(await registerV2Tools(
            context,
            registerAllTools(runtime.directory, runtime.asyncAgentTools),
        ));
        registrations.push(await registerV2Commands(context, handlerContext));
        stopEvents = startV2EventBridge(
            context,
            createEventHandler(handlerContext),
            bridge.statuses,
        );
    } catch (error) {
        try {
            await disposeV2(registrations, stopEvents, runtime.shutdownManager);
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], "OpenCode 2 setup and cleanup failed");
        }
        throw error;
    }
    return () => disposeV2(registrations, stopEvents, runtime.shutdownManager);
}

async function disposeV2(registrations: Registration[], stopEvents: (() => void) | undefined, shutdownManager: PluginRuntime["shutdownManager"]): Promise<void> {
    stopEvents?.();
    const results = await Promise.allSettled(registrations.map(registration =>
        Promise.resolve().then(() => registration.dispose()),
    ));
    await shutdownManager.shutdown();
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length === 1) throw failures[0].reason;
    if (failures.length > 1) throw new AggregateError(failures.map(failure => failure.reason), "OpenCode 2 registration cleanup failed");
}

async function registerHooks(context: Context, handlerContext: PluginRuntime["handlerContext"], temperatures: Readonly<Record<string, number>>, registrations: Registration[]): Promise<void> {
    const chat = createChatMessageHandler(handlerContext);
    const before = createToolExecuteBeforeHandler(handlerContext);
    const after = createToolExecuteAfterHandler(handlerContext);
    const compact = createSessionCompactingHandler(handlerContext);
    const system = createSystemTransformHandler(handlerContext);
    const { sessions } = handlerContext;
    const hooks = [
        () => context.session.hook("prompt", input => runPromptHook(chat, input, sessions)),
        () => context.session.hook("context", async input => {
            await runSystemHook(system, input, temperatures);
            runMessageGuard(input);
            rememberContextAgent(sessions, input as V2ContextRequest);
        }),
        () => context.session.hook("compaction", input => runCompactionHook(compact, input)),
        () => context.tool.hook("execute.before", input => runBeforeToolHook(before, input)),
        () => context.tool.hook("execute.after", input => runAfterToolHook(after, input)),
    ];
    const results = await Promise.allSettled(hooks.map(hook => Promise.resolve().then(hook)));
    for (const result of results) {
        if (result.status === "fulfilled") registrations.push(result.value);
    }
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure) throw failure.reason;
}

type SessionStates = PluginRuntime["handlerContext"]["sessions"];

/**
 * V2 prompt hooks carry no agent; only the per-request `context` hook does.
 * The latest one is kept on the existing session state (which the session's
 * lifecycle already bounds) so prompt hooks and tool hooks can attribute work.
 */
function rememberContextAgent(sessions: SessionStates, request: V2ContextRequest): void {
    const session = sessions.get(request.sessionID);
    const agent = (request.agent || "").toLowerCase();
    if (session && agent) session.agent = agent;
}

async function runPromptHook(chat: ReturnType<typeof createChatMessageHandler>, input: unknown, sessions: SessionStates): Promise<void> {
    const prompt = input as { sessionID: string; prompt: { text: string } };
    const output = { parts: [{ type: "text", text: prompt.prompt.text }] };
    // V2 prompt input carries no agent. The context hook records it, but runs after
    // this hook, so the value lags one turn (empty on a session's first prompt,
    // previous agent right after a switch). Readers that act after the turn,
    // such as memory-gate on assistant done, see the updated value.
    const agent = sessions.get(prompt.sessionID)?.agent ?? "";
    await chat(
        { sessionID: prompt.sessionID, agent } as Parameters<typeof chat>[0],
        output as unknown as Parameters<typeof chat>[1],
    );
    prompt.prompt.text = output.parts[0]?.text ?? "";
}

async function runSystemHook(system: ReturnType<typeof createSystemTransformHandler>, input: unknown, temperatures: Readonly<Record<string, number>>): Promise<void> {
    const request = input as V2ContextRequest;
    const temperature = Object.hasOwn(temperatures, request.agent) ? temperatures[request.agent] : undefined;
    if (temperature !== undefined) request.options.temperature = temperature;
    ContextLimitResolver.getInstance().rememberModel(
        request.sessionID,
        request.model.providerID,
        request.model.id,
        undefined,
    );
    const output = { system: [] as string[] };
    await system(
        { sessionID: request.sessionID, agent: request.agent } as unknown as Parameters<typeof system>[0],
        output as Parameters<typeof system>[1],
    );
    request.system.unshift(...output.system.map(text => ({ type: "text" as const, text })));
}

/** Keep a single oversized tool result from blowing the request past the context window. */
function runMessageGuard(input: unknown): void {
    const request = input as { messages?: unknown };
    truncateOversizedMessageParts(request.messages);
}

type V2ContextRequest = {
    sessionID: string;
    agent: string;
    model: { providerID: string; id: string };
    system: Array<{ type: "text"; text: string }>;
    options: { temperature?: number };
};

async function runCompactionHook(compact: ReturnType<typeof createSessionCompactingHandler>, input: unknown): Promise<void> {
    const request = input as { sessionID: string; system: Array<{ type: "text"; text: string }> };
    const output = { context: [] as string[] };
    await compact(
        { sessionID: request.sessionID } as Parameters<typeof compact>[0],
        output as Parameters<typeof compact>[1],
    );
    request.system.push(...output.context.map(text => ({ type: "text" as const, text })));
}

async function runBeforeToolHook(before: ReturnType<typeof createToolExecuteBeforeHandler>, input: unknown): Promise<void> {
    const request = input as { sessionID: string; tool: string; id: string; input: unknown };
    const output = { args: isRecord(request.input) ? request.input : {} };
    await before(
        { sessionID: request.sessionID, tool: request.tool, callID: request.id } as Parameters<typeof before>[0],
        output as Parameters<typeof before>[1],
    );
    request.input = output.args;
}

async function runAfterToolHook(after: ReturnType<typeof createToolExecuteAfterHandler>, input: unknown): Promise<void> {
    const request = input as { sessionID: string; tool: string; id: string; input: unknown; status: string; result?: { content?: unknown }; error?: unknown };
    const original = readResult(request);
    const output = { title: request.tool, output: original, metadata: {} };
    await after(
        { sessionID: request.sessionID, tool: request.tool, callID: request.id, args: request.input } as Parameters<typeof after>[0],
        output as Parameters<typeof after>[1],
    );
    if (request.status === "completed" && request.result) {
        writeResultContent(request.result, original, output.output);
    }
}

function readResult(input: { status: string; result?: unknown; error?: unknown }): string {
    const value = input.status === "completed" ? input.result : input.error;
    if (input.status === "completed" && isRecord(value) && typeof value.content === "string") {
        return value.content;
    }
    if (input.status === "completed" && isRecord(value) && Array.isArray(value.content)) {
        return value.content.filter(isTextContent).map(part => part.text).join("\n");
    }
    if (typeof value === "string") return value;
    return JSON.stringify(value ?? "");
}

function writeResultContent(result: { content?: unknown }, original: string, updated: string): void {
    if (updated === original) return;
    const content = result.content;
    if (!Array.isArray(content)) {
        result.content = updated;
        return;
    }
    const parts: readonly unknown[] = content;
    const textIndices = parts.flatMap((part, index) => isTextContent(part) ? [index] : []);
    const lastTextIndex = textIndices.at(-1);
    if (lastTextIndex === undefined) {
        result.content = [...parts, { type: "text", text: updated }];
        return;
    }
    if (updated.startsWith(original)) {
        result.content = parts.map((part, index) => index === lastTextIndex && isTextContent(part)
            ? { ...part, text: part.text + updated.slice(original.length) }
            : part);
        return;
    }
    const firstTextIndex = textIndices[0];
    result.content = parts.flatMap((part, index) => !isTextContent(part)
        ? [part]
        : index === firstTextIndex ? [{ ...part, text: updated }] : []);
}

function isTextContent(value: unknown): value is { type: "text"; text: string } {
    return isRecord(value) && value.type === "text" && typeof value.text === "string";
}

