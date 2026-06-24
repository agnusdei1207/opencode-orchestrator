/**
 * MemoryGate Hook - Intercepts tool usage and turn completion to maintain memory.
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
import { MemoryLevel, MemoryManager } from "../../core/memory/memory-manager.js";
import { HOOK_ACTIONS } from "../constants.js";
import { MEMORY_CONSTANTS, HOOK_NAMES } from "../../shared/index.js";

export class MemoryGateHook implements PostToolUseHook, AssistantDoneHook {
    name = HOOK_NAMES.MEMORY_GATE;
    private memoryManager = MemoryManager.getInstance();

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
    ): Promise<PostToolResult | HookResult> {
        // Handle PostToolUse
        if (output) {
            return this.handlePostTool(context, toolOrText, input, output);
        }
        // Handle AssistantDone
        else {
            return this.handleAssistantDone(context, toolOrText);
        }
    }

    /**
     * Post-Tool: Capture tool outputs to TASK memory
     */
    private async handlePostTool(
        context: HookContext,
        tool: string,
        input: ToolInput | undefined,
        output: ToolOutput
    ): Promise<PostToolResult> {
        // Skip noisy or irrelevant tools
        if (MEMORY_CONSTANTS.NOISY_TOOLS.includes(tool)) return {};

        const maxContentLength = MEMORY_CONSTANTS.MAX_CONTENT_LENGTH;
        let content = output.output;

        if (content.length > maxContentLength) {
            content = content.substring(0, maxContentLength) + "... [truncated]";
        }

        const memoryText = `Tool [${tool}] result for input ${JSON.stringify(input)}: ${content}`;

        // Add to Task memory (Short-term)
        this.memoryManager.add(MemoryLevel.TASK, memoryText, MEMORY_CONSTANTS.IMPORTANCE.LOW);

        return {};
    }

    /**
     * Assistant Done: Capture turn summary to MISSION memory if important
     */
    private async handleAssistantDone(
        context: HookContext,
        finalText: string
    ): Promise<HookResult> {
        const { KEYWORDS, IMPORTANCE } = MEMORY_CONSTANTS;
        // Look for significant milestones or decisions in the assistant's final text
        if (finalText.includes(KEYWORDS.DONE) || finalText.includes(KEYWORDS.SUCCESS) || finalText.includes(KEYWORDS.ERROR)) {
            const importance = finalText.includes(KEYWORDS.ERROR) ? IMPORTANCE.CRITICAL : IMPORTANCE.HIGH;
            const summary = finalText.length > 500 ? finalText.substring(0, 500) + "..." : finalText;

            this.memoryManager.add(MemoryLevel.MISSION, `Agent [${context.agent}] turn summary: ${summary}`, importance);
        }

        return { action: HOOK_ACTIONS.CONTINUE };
    }
}
