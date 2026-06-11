
/**
 * Agent UI Hook
 * 
 * Decorates tool outputs with UI elements:
 * - Agent headers (e.g. [P] PLANNER Working...)
 * - Task ID tracking
 */

import type { PostToolUseHook, HookContext, PostToolResult, ToolInput, ToolOutput } from "../types.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_NAMES } from "../constants.js";
import { updateCurrentTask } from "../../core/orchestrator/session-manager.js";
import { UI_PATTERNS } from "../../shared/constants/security-patterns.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";

export class AgentUIHook implements PostToolUseHook {
    name = HOOK_NAMES.AGENT_UI;

    async execute(ctx: HookContext, tool: string, input: ToolInput, output: ToolOutput): Promise<PostToolResult> {
        if (tool !== TOOL_NAMES.CALL_AGENT) return {};

        // 1. Task ID Tracking
        const task = typeof input.task === "string" ? input.task : undefined;
        if (task) {
            const taskIdMatch = task.match(UI_PATTERNS.TASK_ID);
            if (taskIdMatch) {
                updateCurrentTask(ctx.sessionID, taskIdMatch[1].toUpperCase());
            }
        }

        // 2. Agent Header Decoration
        const agentName = typeof input.agent === "string" ? input.agent : undefined;
        if (agentName) {
            const indicator = agentName[0].toUpperCase();
            const header = MISSION_MESSAGES.AGENT_HEADER_FORMAT(indicator, agentName.toUpperCase());

            // Wrap output if not already wrapped (simple check)
            if (!output.output.startsWith("[" + indicator + "]")) {
                return { output: header + output.output };
            }
        }

        return {};
    }
}
