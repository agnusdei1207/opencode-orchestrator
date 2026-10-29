import { log } from "../shared/logger.js";
import { HOOK_ACTIONS } from "./constants.js";
import type { HostClient } from "../host/client.js";
import type { ChildSessions } from "../core/session/child-sessions.js";
import type { ContextLimitResolver } from "../core/context/context-limit-resolver.js";
import type { PluginSessionState } from "../plugin-handlers/context.js";

export interface HookContext {
    sessionID: string;
    agent?: string;
    directory: string;
    sessions: Map<string, PluginSessionState>;
    client?: HostClient;
    /** Child sessions of native subagents, for the plugin instance that raised this hook. */
    children?: ChildSessions;
    /** Tool call being handled, for tool hooks. */
    callID?: string;
    /** Context windows of the plugin instance that raised this hook. */
    contextLimits?: Pick<ContextLimitResolver, "resolveForSession">;
}

type ErrorHandling = "continue" | "stop";

export type HookResult =
    | { action: typeof HOOK_ACTIONS.CONTINUE }
    | { action: typeof HOOK_ACTIONS.INJECT; prompts: string[] };

export type ToolInput = Record<string, unknown>;

export interface ToolOutput {
    title: string;
    output: string;
    metadata: Record<string, unknown>;
}

export type PreToolResult = {
    action: typeof HOOK_ACTIONS.ALLOW | typeof HOOK_ACTIONS.BLOCK;
    reason?: string;
};

export type PostToolResult = { output?: string };

export type ChatMessageResult = {
    action: typeof HOOK_ACTIONS.PROCESS | typeof HOOK_ACTIONS.INTERCEPT;
    modifiedMessage?: string;
};

/** Hooks that keep per-session state release it when the session is deleted. */
interface SessionScoped {
    clearSession?(sessionID: string): void;
}

export interface PreToolUseHook extends SessionScoped {
    name: string;
    execute(
        context: HookContext,
        tool: string,
        args: ToolInput
    ): Promise<PreToolResult>;
}

export interface PostToolUseHook extends SessionScoped {
    name: string;
    execute(
        context: HookContext,
        tool: string,
        input: ToolInput,
        output: ToolOutput
    ): Promise<PostToolResult>;
}

export interface ChatMessageHook extends SessionScoped {
    name: string;
    execute(
        context: HookContext,
        message: string
    ): Promise<ChatMessageResult>;
}

export interface AssistantDoneHook extends SessionScoped {
    name: string;
    execute(
        context: HookContext,
        finalText: string
    ): Promise<HookResult>;
}

interface HookRegistration<T> {
    hook: T;
    errorHandling: ErrorHandling;
    /** Runs only in a session that owns an active mission. Safety hooks run everywhere. */
    missionOnly?: boolean;
}

export class HookRegistry {
    private static instance: HookRegistry;

    private preToolHooks: HookRegistration<PreToolUseHook>[] = [];
    private postToolHooks: HookRegistration<PostToolUseHook>[] = [];
    private chatHooks: HookRegistration<ChatMessageHook>[] = [];
    private doneHooks: HookRegistration<AssistantDoneHook>[] = [];

    private constructor() { }

    public static getInstance(): HookRegistry {
        if (!HookRegistry.instance) {
            HookRegistry.instance = new HookRegistry();
        }
        return HookRegistry.instance;
    }

    /** Release every hook's state for a deleted session. */
    clearSession(sessionID: string): void {
        // A hook registered for several events is cleared once.
        const hooks = new Set([...this.preToolHooks, ...this.postToolHooks, ...this.chatHooks, ...this.doneHooks].map(entry => entry.hook));
        for (const hook of hooks) hook.clearSession?.(sessionID);
    }

    registerPreTool(hook: PreToolUseHook, errorHandling: ErrorHandling = "continue") {
        this.preToolHooks.push({ hook, errorHandling });
    }

    registerPostTool(hook: PostToolUseHook, errorHandling: ErrorHandling = "continue", missionOnly = false) {
        this.postToolHooks.push({ hook, errorHandling, missionOnly });
    }

    registerChat(hook: ChatMessageHook, errorHandling: ErrorHandling = "continue") {
        this.chatHooks.push({ hook, errorHandling });
    }

    registerDone(hook: AssistantDoneHook, errorHandling: ErrorHandling = "continue") {
        this.doneHooks.push({ hook, errorHandling });
    }

    async executePreTool(ctx: HookContext, tool: string, args: ToolInput): Promise<PreToolResult> {
        for (const { hook, errorHandling } of this.preToolHooks) {
            try {
                const result = await hook.execute(ctx, tool, args);
                if (result.action === HOOK_ACTIONS.BLOCK) return result;
            } catch (e) {
                log(`[HookRegistry] Error in PreTool hook ${hook.name}`, e);
                if (errorHandling === "stop") throw e;
            }
        }
        return { action: HOOK_ACTIONS.ALLOW };
    }

    async executePostTool(ctx: HookContext, tool: string, input: ToolInput, output: ToolOutput, missionActive = true) {
        for (const { hook, errorHandling, missionOnly } of this.postToolHooks) {
            if (missionOnly && !missionActive) continue;
            try {
                const result = await hook.execute(ctx, tool, input, output);
                if (result && typeof result.output === "string") {
                    output.output = result.output;
                }
            } catch (e) {
                log(`[HookRegistry] Error in PostTool hook ${hook.name}`, e);
                if (errorHandling === "stop") throw e;
            }
        }
    }

    async executeChat(ctx: HookContext, message: string): Promise<ChatMessageResult> {
        let currentMessage = message;

        for (const { hook, errorHandling } of this.chatHooks) {
            try {
                const result = await hook.execute(ctx, currentMessage);

                if (result.action === HOOK_ACTIONS.INTERCEPT) {
                    return { action: HOOK_ACTIONS.INTERCEPT };
                }

                if (result.modifiedMessage) {
                    currentMessage = result.modifiedMessage;
                }
            } catch (e) {
                log(`[HookRegistry] Error in Chat hook ${hook.name}`, e);
                if (errorHandling === "stop") throw e;
            }
        }

        return { action: HOOK_ACTIONS.PROCESS, modifiedMessage: currentMessage };
    }

    /**
     * Every done hook runs, so observers such as memory capture and metrics
     * still record a turn on which an earlier hook asks for an injection. The
     * first injection wins.
     */
    async executeDone(ctx: HookContext, finalText: string): Promise<HookResult> {
        let injection: HookResult | undefined;
        for (const { hook, errorHandling } of this.doneHooks) {
            try {
                const result = await hook.execute(ctx, finalText);
                if (result.action === HOOK_ACTIONS.INJECT) injection ??= result;
            } catch (e) {
                log(`[HookRegistry] Error in Done hook ${hook.name}`, e);
                if (errorHandling === "stop") throw e;
            }
        }
        return injection ?? { action: HOOK_ACTIONS.CONTINUE };
    }
}
