
/**
 * Resource Control Hook
 * 
 * Unifies resource tracking, monitoring, and active memory compaction.
 * Replaces separate ResourceUsageHook and MemoryCompactionHook.
 */

import type { PostToolUseHook, AssistantDoneHook, HookContext, HookResult } from "../types.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { log } from "../../core/agents/logger.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import {
    CONTEXT_THRESHOLDS,
    CONTEXT_MONITOR_CONFIG,
    calculateUsage,
    getAlertLevel,
    formatUsage
} from "../../core/context/context-window-monitor.js";

// Cost Estimations
const COST_PER_1K_INPUT = 0.003;
const COST_PER_1K_OUTPUT = 0.015;

// Compaction Constants
const COMPACTION_THRESHOLD = CONTEXT_THRESHOLDS.WARNING;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export class ResourceControlHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.RESOURCE_CONTROL;

    private lastCompactionTime: Map<string, number> = new Map();

    async execute(ctx: HookContext, toolOrText: string, input?: any, output?: any): Promise<any> {
        const session = ctx.sessions.get(ctx.sessionID);
        if (!session) return { action: HOOK_ACTIONS.CONTINUE };

        // --------------------------------------------------------
        // 1. Resource Tracking (Usage & Cost)
        // --------------------------------------------------------
        if (!session.tokens) {
            session.tokens = { totalInput: 0, totalOutput: 0, estimatedCost: 0 };
        }

        let inputTokens = 0;
        let outputTokens = 0;

        // Estimate based on input/output
        if (input) {
            const inputStr = typeof input === "string" ? input : JSON.stringify(input);
            inputTokens = Math.ceil(inputStr.length / 4);
        }
        if (output) {
            const outputStr = typeof output === "string" ? output : JSON.stringify(output);
            outputTokens = Math.ceil(outputStr.length / 4);
        }

        // For 'AssistantDone', toolOrText is the final text
        if (arguments.length === 2 && typeof toolOrText === 'string') {
            outputTokens = Math.ceil(toolOrText.length / 4);
        }

        session.tokens.totalInput += inputTokens;
        session.tokens.totalOutput += outputTokens;

        const cost = (session.tokens.totalInput / 1000 * COST_PER_1K_INPUT) +
            (session.tokens.totalOutput / 1000 * COST_PER_1K_OUTPUT);
        session.tokens.estimatedCost = Number(cost.toFixed(4));

        // --------------------------------------------------------
        // 2. Memory Analysis & Compaction Trigger
        // --------------------------------------------------------
        const result = await this.checkMemoryHealth(ctx, session);

        // If Reporting needed (e.g. at the end)
        // logic...

        return result;
    }

    private async checkMemoryHealth(ctx: HookContext, session: any): Promise<HookResult> {
        const totalUsed = session.tokens.totalInput + session.tokens.totalOutput;
        const maxTokens = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
        const usage = calculateUsage(totalUsed, maxTokens);

        // Reporting: Log periodically or if threshold crossed
        if (usage > CONTEXT_THRESHOLDS.INFO) {
            // Just log for debug, don't spam user unless critical
            // log(`[ResourceControl] High usage: ${formatUsage(usage, totalUsed, maxTokens)}`);
        }

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
        const compactionPrompt = this.generateCompactionPrompt(usage);

        log(`[ResourceControl] Triggering compaction for session ${ctx.sessionID} (Usage: ${Math.round(usage * 100)}%)`);

        return {
            action: HOOK_ACTIONS.INJECT,
            prompts: [compactionPrompt]
        };
    }

    private generateCompactionPrompt(usage: number): string {
        return `
<system_interrupt type="memory_compaction">
⚠️ **CRITICAL: Context Memory High (${Math.round(usage * 100)}%)**

Your context window is filling up. To prevent memory loss:
1. **STOP** your current task immediately.
2. **SUMMARIZE** all completed work and pending todos.
3. **UPDATE** the file \`./.opencode/context.md\` with this summary.
   - Keep it concise but lossless (don't lose task IDs).
   - Section: ## Current Status, ## Pending Tasks.
4. After updating, output exactly: \`[COMPACTION_COMPLETE]\`

Do this NOW before proceeding.
</system_interrupt>
`;
    }
}
