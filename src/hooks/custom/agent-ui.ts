
/**
 * Agent UI Hook
 * 
 * Decorates tool outputs with UI elements:
 * - Agent headers (e.g. [P] PLANNER Working...)
 * - Task ID tracking
 */

import type { PostToolUseHook, HookContext } from "../types.js";
import { state } from "../../core/orchestrator/index.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_NAMES } from "../constants.js";

export class AgentUIHook implements PostToolUseHook {
    name = HOOK_NAMES.AGENT_UI;

    async execute(ctx: HookContext, tool: string, input: any, output: { title: string; output: string; metadata: any }) {
        if (tool !== TOOL_NAMES.CALL_AGENT) return {};

        const stateSession = state.sessions.get(ctx.sessionID);

        // 1. Task ID Tracking
        if (input?.task && stateSession) {
            const taskIdMatch = input.task.match(/\[(TASK-\d+)\]/i);
            if (taskIdMatch) {
                stateSession.currentTask = taskIdMatch[1].toUpperCase();
            }
        }

        // 2. Agent Header Decoration
        if (input?.agent) {
            const agentName = input.agent as string;
            const indicator = agentName[0].toUpperCase();
            const header = `[${indicator}] [${agentName.toUpperCase()}] Working...\n\n`;

            // Wrap output if not already wrapped (simple check)
            if (!output.output.startsWith("[" + indicator + "]")) {
                return { output: header + output.output };
            }
        }

        return {};
    }
}
