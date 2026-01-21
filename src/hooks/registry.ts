
/**
 * Hook Registry
 * Manages registration and execution of hooks.
 */

import { log } from "../core/agents/logger.js";
import type {
    PreToolUseHook,
    PostToolUseHook,
    ChatMessageHook,
    AssistantDoneHook,
    HookContext,
    HookResult
} from "./types.js";
import { HOOK_ACTIONS } from "./constants.js";

export class HookRegistry {
    private static instance: HookRegistry;

    private preToolHooks: PreToolUseHook[] = [];
    private postToolHooks: PostToolUseHook[] = [];
    private chatHooks: ChatMessageHook[] = [];
    private doneHooks: AssistantDoneHook[] = [];

    private constructor() { }

    public static getInstance(): HookRegistry {
        if (!HookRegistry.instance) {
            HookRegistry.instance = new HookRegistry();
        }
        return HookRegistry.instance;
    }

    registerPreTool(hook: PreToolUseHook) { this.preToolHooks.push(hook); }
    registerPostTool(hook: PostToolUseHook) { this.postToolHooks.push(hook); }
    registerChat(hook: ChatMessageHook) { this.chatHooks.push(hook); }
    registerDone(hook: AssistantDoneHook) { this.doneHooks.push(hook); }

    async executePreTool(ctx: HookContext, tool: string, args: any): Promise<{ action: typeof HOOK_ACTIONS.ALLOW | typeof HOOK_ACTIONS.BLOCK | typeof HOOK_ACTIONS.MODIFY; modifiedArgs?: any; reason?: string }> {
        for (const hook of this.preToolHooks) {
            try {
                const result = await hook.execute(ctx, tool, args);
                if (result.action === HOOK_ACTIONS.BLOCK) return result;
                if (result.action === HOOK_ACTIONS.MODIFY && result.modifiedArgs) {
                    args = result.modifiedArgs;
                }
            } catch (e) {
                log(`[HookRegistry] Error in PreTool hook ${hook.name}`, e);
            }
        }
        return { action: HOOK_ACTIONS.ALLOW, modifiedArgs: args };
    }

    async executePostTool(ctx: HookContext, tool: string, input: any, output: { title: string; output: string; metadata: any }) {
        for (const hook of this.postToolHooks) {
            try {
                const result = await hook.execute(ctx, tool, input, output);
                if (result?.output) {
                    output.output = result.output;
                }
            } catch (e) {
                log(`[HookRegistry] Error in PostTool hook ${hook.name}`, e);
            }
        }
    }

    async executeChat(ctx: HookContext, message: string): Promise<{ action: typeof HOOK_ACTIONS.PROCESS | typeof HOOK_ACTIONS.INTERCEPT; modifiedMessage?: string }> {
        let currentMessage = message;

        for (const hook of this.chatHooks) {
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
            }
        }

        return { action: HOOK_ACTIONS.PROCESS, modifiedMessage: currentMessage };
    }

    async executeDone(ctx: HookContext, finalText: string): Promise<HookResult> {
        for (const hook of this.doneHooks) {
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
            }
        }

        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
