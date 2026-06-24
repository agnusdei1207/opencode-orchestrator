/**
 * Hook Registry
 * Manages registration and execution of hooks with priority and dependency support.
 */

import { log } from "../core/agents/logger.js";
import { HOOK_ACTIONS } from "./constants.js";

export interface HookContext {
    sessionID: string;
    agent?: string;
    directory: string;
    sessions: Map<string, unknown>;
}

export interface HookMetadata {
    name: string;
    priority: number;
    phase?: "early" | "normal" | "late";
    dependencies?: string[];
    errorHandling?: "continue" | "stop" | "retry";
}

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
    metadata: HookMetadata;
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

    registerPreTool(hook: PreToolUseHook, metadata?: Partial<HookMetadata>) {
        this.preToolHooks.push({ hook, metadata: this.prepareMetadata(hook.name, metadata) });
        this.sortHooks(this.preToolHooks);
    }

    registerPostTool(hook: PostToolUseHook, metadata?: Partial<HookMetadata>) {
        this.postToolHooks.push({ hook, metadata: this.prepareMetadata(hook.name, metadata) });
        this.sortHooks(this.postToolHooks);
    }

    registerChat(hook: ChatMessageHook, metadata?: Partial<HookMetadata>) {
        this.chatHooks.push({ hook, metadata: this.prepareMetadata(hook.name, metadata) });
        this.sortHooks(this.chatHooks);
    }

    registerDone(hook: AssistantDoneHook, metadata?: Partial<HookMetadata>) {
        this.doneHooks.push({ hook, metadata: this.prepareMetadata(hook.name, metadata) });
        this.sortHooks(this.doneHooks);
    }

    unregisterPreTool(hook: PreToolUseHook): boolean {
        return this.unregisterHook(this.preToolHooks, hook);
    }

    unregisterPostTool(hook: PostToolUseHook): boolean {
        return this.unregisterHook(this.postToolHooks, hook);
    }

    unregisterChat(hook: ChatMessageHook): boolean {
        return this.unregisterHook(this.chatHooks, hook);
    }

    unregisterDone(hook: AssistantDoneHook): boolean {
        return this.unregisterHook(this.doneHooks, hook);
    }

    private unregisterHook<T>(registrations: HookRegistration<T>[], hook: T): boolean {
        const originalLength = registrations.length;
        const remaining = registrations.filter(registration => registration.hook !== hook);
        registrations.length = 0;
        registrations.push(...remaining);
        return registrations.length !== originalLength;
    }

    private prepareMetadata(name: string, metadata?: Partial<HookMetadata>): HookMetadata {
        return {
            name: metadata?.name || name,
            priority: metadata?.priority ?? 50,
            phase: metadata?.phase || "normal",
            dependencies: metadata?.dependencies || [],
            errorHandling: metadata?.errorHandling || "continue"
        };
    }

    private sortHooks<T>(registrations: HookRegistration<T>[]) {
        // Initial sort by phase and priority
        registrations.sort((a, b) => {
            const phaseOrder = { early: 0, normal: 1, late: 2 };
            const phaseA = phaseOrder[a.metadata.phase || "normal"];
            const phaseB = phaseOrder[b.metadata.phase || "normal"];

            if (phaseA !== phaseB) return phaseA - phaseB;
            return a.metadata.priority - b.metadata.priority;
        });

        // Refine with topological sort for dependencies
        try {
            const sorted = this.topologicalSort(registrations);
            registrations.length = 0;
            registrations.push(...sorted);
        } catch (e) {
            log(`[HookRegistry] Dependency sort failed: ${e}`);
            throw e;
        }
    }

    private topologicalSort<T>(registrations: HookRegistration<T>[]): HookRegistration<T>[] {
        const sorted: HookRegistration<T>[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const nameToReg = new Map(registrations.map(r => [r.metadata.name, r]));

        const visit = (name: string) => {
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected in hooks: ${name}`);
            }
            if (visited.has(name)) return;

            visiting.add(name);
            const reg = nameToReg.get(name);
            if (reg) {
                for (const dep of reg.metadata.dependencies || []) {
                    visit(dep);
                }
            }

            visiting.delete(name);
            visited.add(name);
            if (reg) sorted.push(reg);
        };

        for (const reg of registrations) {
            visit(reg.metadata.name);
        }

        return sorted;
    }

    private validateDependencies<T>(registrations: HookRegistration<T>[]): void {
        const knownNames = new Set(registrations.map(r => r.metadata.name));
        for (const reg of registrations) {
            for (const dep of reg.metadata.dependencies || []) {
                if (!knownNames.has(dep)) {
                    throw new Error(`Missing hook dependency: ${dep}`);
                }
            }
        }
    }

    async executePreTool(ctx: HookContext, tool: string, args: ToolInput): Promise<PreToolResult> {
        this.validateDependencies(this.preToolHooks);
        for (const { hook, metadata } of this.preToolHooks) {
            try {
                const result = await hook.execute(ctx, tool, args);
                if (result.action === HOOK_ACTIONS.BLOCK) return result;
                if (result.action === HOOK_ACTIONS.MODIFY && result.modifiedArgs) {
                    args = result.modifiedArgs;
                }
            } catch (e) {
                log(`[HookRegistry] Error in PreTool hook ${metadata.name}`, e);
                if (metadata.errorHandling === "stop") throw e;
            }
        }
        return { action: HOOK_ACTIONS.ALLOW, modifiedArgs: args };
    }

    async executePostTool(ctx: HookContext, tool: string, input: ToolInput, output: ToolOutput) {
        this.validateDependencies(this.postToolHooks);
        for (const { hook, metadata } of this.postToolHooks) {
            try {
                const result = await hook.execute(ctx, tool, input, output);
                if (result && typeof result.output === "string") {
                    output.output = result.output;
                }
            } catch (e) {
                log(`[HookRegistry] Error in PostTool hook ${metadata.name}`, e);
                if (metadata.errorHandling === "stop") throw e;
            }
        }
    }

    async executeChat(ctx: HookContext, message: string): Promise<ChatMessageResult> {
        this.validateDependencies(this.chatHooks);
        let currentMessage = message;

        for (const { hook, metadata } of this.chatHooks) {
            try {
                const result = await hook.execute(ctx, currentMessage);

                if (result.action === HOOK_ACTIONS.INTERCEPT) {
                    return { action: HOOK_ACTIONS.INTERCEPT };
                }

                if (result.modifiedMessage) {
                    currentMessage = result.modifiedMessage;
                }
            } catch (e) {
                log(`[HookRegistry] Error in Chat hook ${metadata.name}`, e);
                if (metadata.errorHandling === "stop") throw e;
            }
        }

        return { action: HOOK_ACTIONS.PROCESS, modifiedMessage: currentMessage };
    }

    async executeDone(ctx: HookContext, finalText: string): Promise<HookResult> {
        this.validateDependencies(this.doneHooks);
        for (const { hook, metadata } of this.doneHooks) {
            try {
                const result = await hook.execute(ctx, finalText);

                if (result.action === HOOK_ACTIONS.STOP) {
                    return result;
                }

                if (result.action === HOOK_ACTIONS.INJECT) {
                    return result;
                }
            } catch (e) {
                log(`[HookRegistry] Error in Done hook ${metadata.name}`, e);
                if (metadata.errorHandling === "stop") throw e;
            }
        }

        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
