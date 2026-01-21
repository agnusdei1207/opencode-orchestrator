
/**
 * Agent UI Hook
 * 
 * Decorates tool outputs with UI elements:
 * - Agent headers (e.g. [P] PLANNER Working...)
 * - Task ID tracking
 */

import type { PostToolUseHook, HookContext } from "../types.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_NAMES } from "../constants.js";
import { updateCurrentTask } from "../../core/orchestrator/session-manager.js";
import { UI_PATTERNS } from "../../shared/constants/security-patterns.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";

export class AgentUIHook implements PostToolUseHook {
    name = HOOK_NAMES.AGENT_UI;

    async execute(ctx: HookContext, tool: string, input: any, output: { title: string; output: string; metadata: any }) {
        if (tool !== TOOL_NAMES.CALL_AGENT) return {};

        // 1. Task ID Tracking
        if (input?.task) {
            const taskIdMatch = input.task.match(UI_PATTERNS.TASK_ID);
            if (taskIdMatch) {
                updateCurrentTask(ctx.sessionID, taskIdMatch[1].toUpperCase());
            }
        }

        // 2. Agent Header Decoration
        if (input?.agent) {
            const agentName = input.agent as string;
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
