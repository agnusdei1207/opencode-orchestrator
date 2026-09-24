/**
 * Chat Params Handler
 *
 * Hook: chat.params
 *
 * Runs before every LLM call with the model the host resolved for it. The
 * context monitor reads the host model window (issue #40). Configured
 * agent temperatures are applied when the model reports support.
 */

import type { Hooks } from "@opencode-ai/plugin";
import { ContextLimitResolver } from "../core/context/context-limit-resolver.js";

type ChatParamsHook = NonNullable<Hooks["chat.params"]>;
export type ChatParamsInput = Parameters<ChatParamsHook>[0];
export type ChatParamsOutput = Parameters<ChatParamsHook>[1];

export function createChatParamsHandler(temperatures: Readonly<Record<string, number>> = {}) {
    return async (input: ChatParamsInput, output: ChatParamsOutput): Promise<void> => {
        const model = input.model;
        if (!model) return;

        const temperature = Object.hasOwn(temperatures, input.agent) ? temperatures[input.agent] : undefined;
        if (temperature !== undefined && model.capabilities?.temperature !== false) {
            output.temperature = temperature;
        }

        ContextLimitResolver.getInstance().rememberModel(
            input.sessionID,
            model.providerID,
            model.id,
            model.limit?.context,
        );
    };
}
