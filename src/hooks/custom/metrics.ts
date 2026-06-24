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
    private metrics = MetricsCollector.getInstance();

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
        // Pre-Tool
        if (!output && input) {
            this.startTimes.set(`tool_${toolOrText}_${context.sessionID}`, Date.now());
            return { action: HOOK_ACTIONS.ALLOW };
        }
        // Post-Tool
        else if (output) {
            const startTime = this.startTimes.get(`tool_${toolOrText}_${context.sessionID}`);
            if (startTime) {
                const duration = Date.now() - startTime;
                this.metrics.recordToolExecution(toolOrText, duration);
                this.startTimes.delete(`tool_${toolOrText}_${context.sessionID}`);
            }

            // Simple token estimation from output (rough)
            this.metrics.recordTokenUsage(output.output.length / 4);
            return {};
        }
        // Assistant Done
        else {
            // Text completion record (could be more sophisticated)
            this.metrics.recordTokenUsage(toolOrText.length / 4);
            return { action: HOOK_ACTIONS.CONTINUE };
        }
    }
}
