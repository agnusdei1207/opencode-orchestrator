
/**
 * Resource Control Hook
 * 
 * Unifies resource tracking, monitoring, and active memory compaction.
 * Replaces separate ResourceUsageHook and MemoryCompactionHook.
 */

import type {
    PostToolUseHook,
    AssistantDoneHook,
    HookContext,
    HookResult,
    PostToolResult,
    ToolInput,
    ToolOutput,
} from "../types.js";
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

interface TokenTrackedSession {
    tokens?: {
        totalInput: number;
        totalOutput: number;
    };
}

export class ResourceControlHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.RESOURCE_CONTROL;

    private lastCompactionTime: Map<string, number> = new Map();

    async execute(
        ctx: HookContext,
        tool: string,
        input: ToolInput,
        output: ToolOutput
    ): Promise<PostToolResult>;
    async execute(
        ctx: HookContext,
        finalText: string
    ): Promise<HookResult>;
    async execute(ctx: HookContext, toolOrText: string, input?: unknown, output?: unknown): Promise<PostToolResult | HookResult> {
        // --------------------------------------------------------
        // 1. Resource Tracking (Usage & Cost)
        // --------------------------------------------------------

        const isAssistantDone = input === undefined && output === undefined;
        const inputLen = isAssistantDone ? 0 : getSerializedLength(input);
        let outputLen = getSerializedLength(output);

        // For 'AssistantDone', toolOrText is the final text
        if (isAssistantDone) {
            outputLen = toolOrText.length;
        }

        // Use Manager to update state
        updateSessionTokens(ctx.sessions, ctx.sessionID, inputLen, outputLen);

        // --------------------------------------------------------
        // 2. Memory Analysis & Compaction Trigger
        // --------------------------------------------------------
        if (!isAssistantDone) {
            return {};
        }

        const session = ctx.sessions.get(ctx.sessionID); // Updated by ensureSessionInitialized inside updateTokens
        return this.checkMemoryHealth(ctx, session);
    }

    private async checkMemoryHealth(ctx: HookContext, session: unknown): Promise<HookResult> {
        if (!hasTokenUsage(session)) return { action: HOOK_ACTIONS.CONTINUE };

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

function getSerializedLength(value: unknown): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === "string") return value.length;

    try {
        return JSON.stringify(value)?.length ?? 0;
    } catch {
        return String(value).length;
    }
}

function hasTokenUsage(session: unknown): session is TokenTrackedSession & Required<Pick<TokenTrackedSession, "tokens">> {
    if (typeof session !== "object" || session === null || Array.isArray(session)) return false;

    const tokens = (session as { tokens?: unknown }).tokens;
    if (typeof tokens !== "object" || tokens === null || Array.isArray(tokens)) return false;

    const candidate = tokens as { totalInput?: unknown; totalOutput?: unknown };
    return typeof candidate.totalInput === "number" && typeof candidate.totalOutput === "number";
}
