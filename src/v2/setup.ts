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
    const hooks = [
        () => context.session.hook("prompt", input => runPromptHook(chat, input)),
        () => context.session.hook("context", input => runSystemHook(system, input, temperatures)),
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

async function runPromptHook(chat: ReturnType<typeof createChatMessageHandler>, input: unknown): Promise<void> {
    const prompt = input as { sessionID: string; prompt: { text: string } };
    const output = { parts: [{ type: "text", text: prompt.prompt.text }] };
    await chat(
        { sessionID: prompt.sessionID, agent: "" } as Parameters<typeof chat>[0],
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
    const output = { title: request.tool, output: readResult(request), metadata: {} };
    await after(
        { sessionID: request.sessionID, tool: request.tool, callID: request.id, args: request.input } as Parameters<typeof after>[0],
        output as Parameters<typeof after>[1],
    );
    if (request.status === "completed" && request.result) request.result.content = output.output;
}

function readResult(input: { status: string; result?: unknown; error?: unknown }): string {
    const value = input.status === "completed" ? input.result : input.error;
    if (typeof value === "string") return value;
    return JSON.stringify(value ?? "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
