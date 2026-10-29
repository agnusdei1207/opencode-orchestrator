/**
 * MetricsHook - Collects telemetry during mission execution
 */

import type {
    PreToolUseHook,
    PostToolUseHook,
    AssistantDoneHook,
    HookContext,
    HookResult,
    PostToolResult,
    PreToolResult,
    ToolInput,
    ToolOutput,
} from "../registry.js";
import { MetricsCollector } from "../../core/metrics/collector.js";
import { HOOK_ACTIONS } from "../constants.js";
import { HOOK_NAMES } from "../../shared/index.js";

export class MetricsHook implements PreToolUseHook, PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.METRICS_TELEMETRY;
    private startTimes: Map<string, number> = new Map();

    async execute(
        context: HookContext,
        tool: string,
        input: ToolInput
    ): Promise<PreToolResult>;
    async execute(
        context: HookContext,
        tool: string,
        input: ToolInput,
        output: ToolOutput
    ): Promise<PostToolResult>;
    async execute(
        context: HookContext,
        finalText: string
    ): Promise<HookResult>;
    async execute(
        context: HookContext,
        toolOrText: string,
        input?: ToolInput,
        output?: ToolOutput
    ): Promise<PreToolResult | PostToolResult | HookResult> {
        // Keyed by call ID so parallel calls of one tool keep their own start time.
        const key = `${context.sessionID}:${context.callID ?? toolOrText}`;
        // Pre-Tool
        if (!output && input) {
            this.startTimes.set(key, Date.now());
            return { action: HOOK_ACTIONS.ALLOW };
        }
        // Post-Tool
        else if (output) {
            const startTime = this.startTimes.get(key);
            this.startTimes.delete(key);
            if (startTime) {
                MetricsCollector.getInstance(context.directory).recordToolExecution(toolOrText, Date.now() - startTime);
            }

            // Simple token estimation from output (rough)
            MetricsCollector.getInstance(context.directory).recordTokenUsage(output.output.length / 4);
            return {};
        }
        // Assistant Done
        else {
            // Text completion record (could be more sophisticated)
            MetricsCollector.getInstance(context.directory).recordTokenUsage(toolOrText.length / 4);
            return { action: HOOK_ACTIONS.CONTINUE };
        }
    }
}
