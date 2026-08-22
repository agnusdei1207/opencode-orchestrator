
/**
 * Sanity Check Hook
 * Implements output anomaly detection.
 *
 * Acting on a suspected anomaly is not free: it rewrites a tool result or
 * injects a recovery turn into the live session. So the hook only reacts to
 * CRITICAL findings, and only after a cooldown, which bounds the blast radius of
 * any detector that misjudges an unusual but healthy output (issue #35).
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
import { checkOutputSanity, RECOVERY_PROMPT, ESCALATION_PROMPT, type SanityResult } from "../../utils/sanity/index.js";
// Imported from the leaf module, not the barrel: severity is a plain constant
// and must stay readable even when a test substitutes the detector barrel.
import { SEVERITY } from "../../utils/sanity/constants/severity.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import { recordAnomaly, resetAnomaly } from "../../core/orchestrator/session-manager.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";
import { log } from "../../core/agents/logger.js";

/**
 * Minimum gap between two anomaly interventions for the same session. Real
 * degeneration persists and will still be caught on the next turn; a
 * misclassification stops costing tokens on every single turn.
 */
const ANOMALY_COOLDOWN_MS = 60_000;

/** Anomaly count at which recovery advice escalates to a full replan. */
const ESCALATION_THRESHOLD = 2;

export class SanityCheckHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.SANITY_CHECK;

    /** Last intervention timestamp per session, for cooldown. */
    private readonly lastInterventionAt = new Map<string, number>();

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
    async execute(
        ctx: HookContext,
        toolOrText: string,
        input?: ToolInput,
        output?: ToolOutput
    ): Promise<PostToolResult | HookResult> {
        // Handle PostToolUse (checks CallAgent output)
        if (output) {
            if (toolOrText === TOOL_NAMES.CALL_AGENT) {
                return this.checkToolOutput(ctx, input, output);
            }

            return {};
        }
        // Handle AssistantDone (checks final text)
        else {
            return this.checkFinalText(ctx, toolOrText);
        }
    }

    private async checkToolOutput(ctx: HookContext, toolInput: ToolInput | undefined, toolOutput: ToolOutput): Promise<PostToolResult> {
        const sanityResult = checkOutputSanity(toolOutput.output);

        if (!this.shouldIntervene(ctx.sessionID, sanityResult)) {
            if (sanityResult.isHealthy) resetAnomaly(ctx.sessionID);
            return {};
        }

        const count = recordAnomaly(ctx.sessionID);
        const agentName = typeof toolInput?.agent === "string" ? toolInput.agent : "unknown";

        return {
            output: MISSION_MESSAGES.ANOMALY_DETECTED_TITLE(agentName.toUpperCase()) + "\n\n" +
                MISSION_MESSAGES.ANOMALY_DETECTED_BODY(this.reasonOf(sanityResult), count, recoveryTextFor(count)),
        };
    }

    private async checkFinalText(ctx: HookContext, finalText: string): Promise<HookResult> {
        const sanityResult = checkOutputSanity(finalText);

        if (!this.shouldIntervene(ctx.sessionID, sanityResult)) {
            if (sanityResult.isHealthy) resetAnomaly(ctx.sessionID);
            return { action: HOOK_ACTIONS.CONTINUE };
        }

        const count = recordAnomaly(ctx.sessionID);
        return {
            action: HOOK_ACTIONS.INJECT,
            prompts: [MISSION_MESSAGES.ANOMALY_INJECT_MSG(count, this.reasonOf(sanityResult), recoveryTextFor(count))],
        };
    }

    /**
     * Gate every intervention on severity and cooldown, and stamp the cooldown
     * as a side effect so both call sites share one budget per session.
     */
    private shouldIntervene(sessionID: string, result: SanityResult): boolean {
        if (result.isHealthy) return false;
        if (result.severity !== SEVERITY.CRITICAL) {
            log("[sanity-check] Non-critical anomaly ignored", { sessionID, reason: result.reason });
            return false;
        }

        const now = Date.now();
        const previous = this.lastInterventionAt.get(sessionID);
        if (previous !== undefined && now - previous < ANOMALY_COOLDOWN_MS) {
            log("[sanity-check] Anomaly suppressed by cooldown", { sessionID, reason: result.reason });
            return false;
        }

        this.lastInterventionAt.set(sessionID, now);
        return true;
    }

    private reasonOf(result: SanityResult): string {
        return result.reason || "Unknown anomaly";
    }

    /** Forget a session's cooldown state. */
    clearSession(sessionID: string): void {
        this.lastInterventionAt.delete(sessionID);
    }
}

function recoveryTextFor(anomalyCount: number): string {
    return anomalyCount >= ESCALATION_THRESHOLD ? ESCALATION_PROMPT : RECOVERY_PROMPT;
}
