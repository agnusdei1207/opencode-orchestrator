
/**
 * Sanity Check Hook
 * Implements output anomaly detection.
 */
import type { PostToolUseHook, AssistantDoneHook, HookContext, HookResult } from "../types.js";
import { state } from "../../core/orchestrator/index.js";
import { checkOutputSanity, RECOVERY_PROMPT, ESCALATION_PROMPT } from "../../utils/sanity/index.js";
import { TOOL_NAMES, PART_TYPES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";

export class SanityCheckHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.SANITY_CHECK;

    async execute(
        ctx: HookContext,
        toolOrText: string,
        input?: any,
        output?: { title: string; output: string; metadata: any }
    ): Promise<any> {
        // Handle PostToolUse (checks CallAgent output)
        if (output) {
            // It's a tool output check
            if (toolOrText === TOOL_NAMES.CALL_AGENT) {
                return this.checkToolOutput(ctx, input, output);
            }
        }
        // Handle AssistantDone (checks final text)
        else {
            return this.checkFinalText(ctx, toolOrText);
        }
    }

    private async checkToolOutput(ctx: HookContext, toolInput: any, toolOutput: { output: string }) {
        const stateSession = state.sessions.get(ctx.sessionID);
        if (!stateSession) return {};

        const sanityResult = checkOutputSanity(toolOutput.output);
        if (!sanityResult.isHealthy) {
            stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
            const agentName = toolInput?.agent as string || "unknown";

            const errorMsg = `[${agentName.toUpperCase()}] OUTPUT ANOMALY DETECTED\n\n` +
                `Gibberish/loop detected: ${sanityResult.reason}\n` +
                `Anomaly count: ${stateSession.anomalyCount}\n\n` +
                (stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT);

            return { output: errorMsg };
        } else {
            if (stateSession.anomalyCount > 0) stateSession.anomalyCount = 0;
        }
        return {};
    }

    private async checkFinalText(ctx: HookContext, finalText: string): Promise<HookResult> {
        const stateSession = state.sessions.get(ctx.sessionID);
        if (!stateSession) return { action: HOOK_ACTIONS.CONTINUE };

        const sanityResult = checkOutputSanity(finalText);
        if (!sanityResult.isHealthy) {
            stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
            const recoveryText = stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT;

            return {
                action: HOOK_ACTIONS.INJECT,
                prompts: [`⚠️ ANOMALY #${stateSession.anomalyCount}: ${sanityResult.reason}\n\n${recoveryText}`]
            };
        }

        if (stateSession.anomalyCount > 0) stateSession.anomalyCount = 0;
        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
