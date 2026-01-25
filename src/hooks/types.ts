
/**
 * Hook System Types
 * Defines the contract for all hooks in the system.
 */

import { HOOK_ACTIONS } from "./constants.js";

export interface HookContext {
    sessionID: string;
    agent?: string;
    directory: string; // Added
    sessions: Map<string, unknown>; // Added
}

export interface HookMetadata {
    name: string;
    priority: number; // 0-100, lower runs first
    phase?: "early" | "normal" | "late";
    dependencies?: string[];
    errorHandling?: "continue" | "stop" | "retry";
}

export type HookResult =
    | { action: typeof HOOK_ACTIONS.CONTINUE }
    | { action: typeof HOOK_ACTIONS.STOP; reason?: string }
    | { action: typeof HOOK_ACTIONS.INJECT; prompts: string[] };

/**
 * Pre-Tool Execution Hook
 * Runs before a tool is executed. Can block execution or modify arguments.
 */
export interface PreToolUseHook {
    name: string;
    execute(
        context: HookContext,
        tool: string,
        args: Record<string, unknown>
    ): Promise<{ action: typeof HOOK_ACTIONS.ALLOW | typeof HOOK_ACTIONS.BLOCK | typeof HOOK_ACTIONS.MODIFY; modifiedArgs?: Record<string, unknown>; reason?: string }>;
}

/**
 * Post-Tool Execution Hook
 * Runs after a tool is executed. Can analyze output or trigger side effects.
 */
export interface PostToolUseHook {
    name: string;
    execute(
        context: HookContext,
        tool: string,
        input: Record<string, unknown>,
        output: { title: string; output: string; metadata: Record<string, unknown> }
    ): Promise<{ output?: string }>; // meaningful valid return modification
}

/**
 * Chat Message Hook
 * Runs when a user sends a message. Can intercept commands.
 */
export interface ChatMessageHook {
    name: string;
    execute(
        context: HookContext,
        message: string
    ): Promise<{ action: typeof HOOK_ACTIONS.PROCESS | typeof HOOK_ACTIONS.INTERCEPT; modifiedMessage?: string }>;
}

/**
 * Assistant Done Hook
 * Runs when the assistant finishes a turn. Can inject continuation prompts.
 */
export interface AssistantDoneHook {
    name: string;
    execute(
        context: HookContext,
        finalText: string
    ): Promise<HookResult>;
}
