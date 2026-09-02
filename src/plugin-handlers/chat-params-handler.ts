/**
 * Chat Params Handler
 *
 * Hook: chat.params
 *
 * Runs before every LLM call with the model the host resolved for it. The
 * only thing the orchestrator needs from it is the model's context window,
 * which the context monitor measures usage against (issue #40). Nothing in
 * the output is changed.
 */

import type { Hooks } from "@opencode-ai/plugin";
import { ContextLimitResolver } from "../core/context/context-limit-resolver.js";

type ChatParamsHook = NonNullable<Hooks["chat.params"]>;
export type ChatParamsInput = Parameters<ChatParamsHook>[0];
export type ChatParamsOutput = Parameters<ChatParamsHook>[1];

export function createChatParamsHandler() {
    return async (input: ChatParamsInput, _output: ChatParamsOutput): Promise<void> => {
        const model = input.model;
        if (!model) return;

        ContextLimitResolver.getInstance().rememberModel(
            input.sessionID,
            model.providerID,
            model.id,
            model.limit?.context,
        );
    };
}
