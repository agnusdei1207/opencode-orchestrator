import { log } from "../core/agents/logger.js";
import { HOOK_ACTIONS } from "./constants.js";

export interface HookContext {
    sessionID: string;
    agent?: string;
    directory: string;
    sessions: Map<string, unknown>;
}

type ErrorHandling = "continue" | "stop";

export type HookResult =
    | { action: typeof HOOK_ACTIONS.CONTINUE }
    | { action: typeof HOOK_ACTIONS.STOP; reason?: string }
    | { action: typeof HOOK_ACTIONS.INJECT; prompts: string[] };

export type ToolInput = Record<string, unknown>;

export interface ToolOutput {
    title: string;
    output: string;
    metadata: Record<string, unknown>;
}

export type PreToolResult = {
    action: typeof HOOK_ACTIONS.ALLOW | typeof HOOK_ACTIONS.BLOCK | typeof HOOK_ACTIONS.MODIFY;
    modifiedArgs?: ToolInput;
    reason?: string;
};

export type PostToolResult = { output?: string };

export type ChatMessageResult = {
    action: typeof HOOK_ACTIONS.PROCESS | typeof HOOK_ACTIONS.INTERCEPT;
    modifiedMessage?: string;
};

export interface PreToolUseHook {
    name: string;
    execute(
        context: HookContext,
        tool: string,
        args: ToolInput
    ): Promise<PreToolResult>;
}

export interface PostToolUseHook {
    name: string;
    execute(
        context: HookContext,
        tool: string,
        input: ToolInput,
        output: ToolOutput
    ): Promise<PostToolResult>;
}

export interface ChatMessageHook {
    name: string;
    execute(
        context: HookContext,
        message: string
    ): Promise<ChatMessageResult>;
}

export interface AssistantDoneHook {
    name: string;
    execute(
        context: HookContext,
        finalText: string
    ): Promise<HookResult>;
}

interface HookRegistration<T> {
    hook: T;
    errorHandling: ErrorHandling;
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

    registerPreTool(hook: PreToolUseHook, errorHandling: ErrorHandling = "continue") {
        this.preToolHooks.push({ hook, errorHandling });
    }

    registerPostTool(hook: PostToolUseHook, errorHandling: ErrorHandling = "continue") {
        this.postToolHooks.push({ hook, errorHandling });
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
                if (result.action === HOOK_ACTIONS.MODIFY && result.modifiedArgs) {
                    args = result.modifiedArgs;
                }
            } catch (e) {
                log(`[HookRegistry] Error in PreTool hook ${hook.name}`, e);
                if (errorHandling === "stop") throw e;
            }
        }
        return { action: HOOK_ACTIONS.ALLOW, modifiedArgs: args };
    }

    async executePostTool(ctx: HookContext, tool: string, input: ToolInput, output: ToolOutput) {
        for (const { hook, errorHandling } of this.postToolHooks) {
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

    async executeDone(ctx: HookContext, finalText: string): Promise<HookResult> {
        for (const { hook, errorHandling } of this.doneHooks) {
            try {
                const result = await hook.execute(ctx, finalText);

                if (result.action === HOOK_ACTIONS.STOP) {
                    return result;
                }

                if (result.action === HOOK_ACTIONS.INJECT) {
                    return result;
                }
            } catch (e) {
                log(`[HookRegistry] Error in Done hook ${hook.name}`, e);
                if (errorHandling === "stop") throw e;
            }
        }

        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
