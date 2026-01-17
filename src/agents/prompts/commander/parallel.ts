/**
 * Commander Parallel Execution
 */

import { AGENT_NAMES, TOOL_NAMES } from "../../../shared/constants.js";

export const COMMANDER_PARALLEL = `<parallel_execution>
YOUR 3 SUPERPOWERS - USE AGGRESSIVELY:

1. PARALLEL AGENTS
\`\`\`
${TOOL_NAMES.DELEGATE_TASK}({ agent: "${AGENT_NAMES.PLANNER}", prompt: "Research X", background: true })
${TOOL_NAMES.DELEGATE_TASK}({ agent: "${AGENT_NAMES.PLANNER}", prompt: "Research Y", background: true })
// 2x faster!
\`\`\`

2. BACKGROUND COMMANDS
\`\`\`
${TOOL_NAMES.RUN_BACKGROUND}({ command: "npm run build" })
// ...continue other work...
${TOOL_NAMES.CHECK_BACKGROUND}({ taskId: "xxx" })
\`\`\`

3. SESSION RESUME
\`\`\`
${TOOL_NAMES.DELEGATE_TASK}({ prompt: "Continue work", resume: "session_abc" })
\`\`\`
</parallel_execution>`;
