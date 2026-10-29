/**
 * MemoryGate Hook - records notable assistant turns in the project's mission memory.
 *
 * Tool output is deliberately not captured: memory is prepended to delegated
 * prompts, and raw tool output from every session made that context large
 * and stale.
 */

import type { AssistantDoneHook, HookContext, HookResult } from "../registry.js";
import { MemoryLevel, MemoryManager } from "../../core/memory/memory-manager.js";
import { HOOK_ACTIONS } from "../constants.js";
import { MEMORY_CONSTANTS, HOOK_NAMES } from "../../shared/index.js";

const MAX_SUMMARY_CHARS = 500;

export class MemoryGateHook implements AssistantDoneHook {
    name = HOOK_NAMES.MEMORY_GATE;

    async execute(context: HookContext, finalText: string): Promise<HookResult> {
        const { KEYWORDS, IMPORTANCE } = MEMORY_CONSTANTS;
        if (finalText.includes(KEYWORDS.DONE) || finalText.includes(KEYWORDS.SUCCESS) || finalText.includes(KEYWORDS.ERROR)) {
            const importance = finalText.includes(KEYWORDS.ERROR) ? IMPORTANCE.CRITICAL : IMPORTANCE.HIGH;
            const summary = finalText.length > MAX_SUMMARY_CHARS ? `${finalText.substring(0, MAX_SUMMARY_CHARS)}...` : finalText;
            const agent = context.agent ?? "unknown";
            MemoryManager.getInstance(context.directory).add(MemoryLevel.MISSION, `Agent [${agent}] turn summary: ${summary}`, importance);
        }
        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
