
/**
 * Sanity Check Hook
 * Implements output anomaly detection.
 */
import type { PostToolUseHook, AssistantDoneHook, HookContext, HookResult } from "../types.js";
import { checkOutputSanity, RECOVERY_PROMPT, ESCALATION_PROMPT } from "../../utils/sanity/index.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import { recordAnomaly, resetAnomaly } from "../../core/orchestrator/session-manager.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";

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
        const sanityResult = checkOutputSanity(toolOutput.output);
        if (!sanityResult.isHealthy) {
            const count = recordAnomaly(ctx.sessionID);
            const agentName = toolInput?.agent as string || "unknown";
            const recoveryText = count >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT;

            const errorMsg = MISSION_MESSAGES.ANOMALY_DETECTED_TITLE(agentName.toUpperCase()) + "\n\n" +
                MISSION_MESSAGES.ANOMALY_DETECTED_BODY(sanityResult.reason || "Unknown anomaly", count, recoveryText);

            return { output: errorMsg };
        } else {
            resetAnomaly(ctx.sessionID);
        }
        return {};
    }

    private async checkFinalText(ctx: HookContext, finalText: string): Promise<HookResult> {
        const sanityResult = checkOutputSanity(finalText);
        if (!sanityResult.isHealthy) {
            const count = recordAnomaly(ctx.sessionID);
            const recoveryText = count >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT;
            const prompt = MISSION_MESSAGES.ANOMALY_INJECT_MSG(count, sanityResult.reason || "Unknown anomaly", recoveryText);

            return {
                action: HOOK_ACTIONS.INJECT,
                prompts: [prompt]
            };
        }

        resetAnomaly(ctx.sessionID);
        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
