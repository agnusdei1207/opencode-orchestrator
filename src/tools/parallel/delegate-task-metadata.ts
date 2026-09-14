import { tool } from "@opencode-ai/plugin";
import {
    PARALLEL_PARAMS,
    PROMPT_TAGS,
    TOOL_NAMES,
} from "../../shared/index.js";

type ToolArgs = Parameters<typeof tool>[0]["args"];

export const DELEGATE_TASK_DESCRIPTION = `Delegate a task to an agent.

${PROMPT_TAGS.MODE.open}
- ${PARALLEL_PARAMS.BACKGROUND}=true: Non-blocking. Returns task ID immediately.
- ${PARALLEL_PARAMS.BACKGROUND}=false: Waits up to five minutes for manager-confirmed completion. A wait timeout or interruption does not cancel the task; inspect get_task_result later.
${PROMPT_TAGS.MODE.close}

${PROMPT_TAGS.RESUME.open}
- ${PARALLEL_PARAMS.RESUME}: Optional session ID to continue existing session.
- When set, continues previous work instead of starting fresh.
- Continues the same native session, subject to OpenCode context and compaction behavior.
- Use for explicitly requested follow-up work after observing the previous result.
${PROMPT_TAGS.RESUME.close}

${PROMPT_TAGS.SAFETY.open}
- Max 10 tasks per agent type (configurable)
- Cancellation is reported only after the host confirms it. Inspect failures before retrying work that may have side effects.
- Use \`${TOOL_NAMES.LIST_AGENTS}\` to see all available agents (including custom ones).
${PROMPT_TAGS.SAFETY.close}`;

export const DELEGATE_TASK_ARGS: ToolArgs = {
    [PARALLEL_PARAMS.AGENT]: tool.schema.string().describe("Agent name"),
    [PARALLEL_PARAMS.DESCRIPTION]: tool.schema.string().describe("Task description"),
    [PARALLEL_PARAMS.PROMPT]: tool.schema.string().describe("Prompt for the agent"),
    [PARALLEL_PARAMS.BACKGROUND]: tool.schema.boolean().describe("true=async, false=sync"),
    [PARALLEL_PARAMS.RESUME]: tool.schema.string().optional().describe("Session ID to resume (from previous task.sessionID)"),
    [PARALLEL_PARAMS.MODE]: tool.schema.enum(["normal", "race", "fractal"]).optional().describe("Task mode (race=first wins, fractal=recursive)"),
    [PARALLEL_PARAMS.GROUP_ID]: tool.schema.string().optional().describe("Group ID for racing or tracking recursive families"),
};
