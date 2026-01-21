
/**
 * Resource Control Hook
 * 
 * Unifies resource tracking, monitoring, and active memory compaction.
 * Replaces separate ResourceUsageHook and MemoryCompactionHook.
 */

import type { PostToolUseHook, AssistantDoneHook, HookContext, HookResult } from "../types.js";
import { log } from "../../core/agents/logger.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import {
    CONTEXT_THRESHOLDS,
    CONTEXT_MONITOR_CONFIG,
    calculateUsage
} from "../../core/context/context-window-monitor.js";

// Refactored Imports
import { updateSessionTokens } from "../../core/orchestrator/session-manager.js";
import { COMPACTION_PROMPT } from "../../shared/constants/system-messages.js";

// Compaction Constants
const COMPACTION_THRESHOLD = CONTEXT_THRESHOLDS.WARNING;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export class ResourceControlHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.RESOURCE_CONTROL;

    private lastCompactionTime: Map<string, number> = new Map();

    async execute(ctx: HookContext, toolOrText: string, input?: any, output?: any): Promise<any> {
        // --------------------------------------------------------
        // 1. Resource Tracking (Usage & Cost)
        // --------------------------------------------------------

        let inputLen = 0;
        let outputLen = 0;

        // Estimate based on input/output length
        if (input) {
            const inputStr = typeof input === "string" ? input : JSON.stringify(input);
            inputLen = inputStr.length;
        }
        if (output) {
            const outputStr = typeof output === "string" ? output : JSON.stringify(output);
            outputLen = outputStr.length;
        }

        // For 'AssistantDone', toolOrText is the final text
        if (arguments.length === 2 && typeof toolOrText === 'string') {
            outputLen = toolOrText.length;
        }

        // Use Manager to update state
        updateSessionTokens(ctx.sessions, ctx.sessionID, inputLen, outputLen);

        // --------------------------------------------------------
        // 2. Memory Analysis & Compaction Trigger
        // --------------------------------------------------------
        const session = ctx.sessions.get(ctx.sessionID); // Updated by ensureSessionInitialized inside updateTokens
        return this.checkMemoryHealth(ctx, session);
    }

    private async checkMemoryHealth(ctx: HookContext, session: any): Promise<HookResult> {
        if (!session?.tokens) return { action: HOOK_ACTIONS.CONTINUE };

        const totalUsed = session.tokens.totalInput + session.tokens.totalOutput;
        const maxTokens = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
        const usage = calculateUsage(totalUsed, maxTokens);

        // Compaction Trigger
        if (usage < COMPACTION_THRESHOLD) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        // Check Cooldown
        const lastTime = this.lastCompactionTime.get(ctx.sessionID) || 0;
        const now = Date.now();
        if (now - lastTime < COOLDOWN_MS) {
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        // Trigger Compaction
        this.lastCompactionTime.set(ctx.sessionID, now);

        const usagePercent = Math.round(usage * 100);
        const prompt = COMPACTION_PROMPT.replace("$USAGE", usagePercent.toString());

        log(`[ResourceControl] Triggering compaction for session ${ctx.sessionID} (Usage: ${usagePercent}%)`);

        return {
            action: HOOK_ACTIONS.INJECT,
            prompts: [prompt]
        };
    }
}
