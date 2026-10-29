/**
 * Mission-only context watch: estimates token use from tool payloads and, when
 * an assistant turn ends near the context limit, asks the model to checkpoint.
 */

import type {
    PostToolUseHook,
    AssistantDoneHook,
    HookContext,
    HookResult,
    PostToolResult,
    ToolInput,
    ToolOutput,
} from "../registry.js";
import { log } from "../../shared/logger.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import {
    CONTEXT_MONITOR_CONFIG,
    CONTEXT_THRESHOLDS,
    calculateUsage,
    getContextUsage,
} from "../../core/context/context-window-monitor.js";
import { ensureSessionInitialized } from "../../core/orchestrator/session-manager.js";
import type { PluginSessionState } from "../../plugin-handlers/context.js";
import { COMPACTION_PROMPT } from "../../shared/constants/system-messages.js";

const COMPACTION_THRESHOLD = CONTEXT_THRESHOLDS.WARNING;
const COOLDOWN_MS = 10 * 60 * 1000;
/** Rough estimate used until the host reports real usage. */
const CHARS_PER_TOKEN = 4;

export class ResourceControlHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.RESOURCE_CONTROL;

    private lastCompactionTime: Map<string, number> = new Map();

    clearSession(sessionID: string): void {
        this.lastCompactionTime.delete(sessionID);
    }

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
        // On assistant-done the second argument is the final text, not a tool name.
        const isAssistantDone = input === undefined && output === undefined;
        const session = ensureSessionInitialized(ctx.sessions, ctx.sessionID);
        session.tokens.totalInput += Math.ceil((isAssistantDone ? 0 : getSerializedLength(input)) / CHARS_PER_TOKEN);
        session.tokens.totalOutput += Math.ceil((isAssistantDone ? toolOrText.length : getSerializedLength(output)) / CHARS_PER_TOKEN);

        if (!isAssistantDone) return {};
        return this.checkMemoryHealth(ctx, session);
    }

    private async checkMemoryHealth(ctx: HookContext, session: PluginSessionState): Promise<HookResult> {
        const measured = measureContext(ctx, session);

        const usage = calculateUsage(measured.usedTokens, measured.maxTokens);

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

/**
 * Prefer the host's own token report for the session (issue #40). The
 * character-count estimate only stands in until the first assistant message
 * has reported real usage; it accumulates every tool payload ever seen and
 * overstates live context on long sessions.
 */
function measureContext(ctx: HookContext, session: PluginSessionState): { usedTokens: number; maxTokens: number } {
    const { sessionID } = ctx;
    const reported = getContextUsage(sessionID);
    if (reported) return reported;

    return {
        usedTokens: session.tokens.totalInput + session.tokens.totalOutput,
        maxTokens: ctx.contextLimits?.resolveForSession(sessionID) ?? CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS,
    };
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
