/**
 * Commander Tools Overview
 */

import { TOOL_NAMES } from "../../../shared/constants.js";

export const COMMANDER_TOOLS = `<tools>
| Tool | Purpose | When |
|------|---------|------|
| ${TOOL_NAMES.DELEGATE_TASK} | Spawn agent | background=true for parallel |
| ${TOOL_NAMES.GET_TASK_RESULT} | Get result | After task completes |
| ${TOOL_NAMES.LIST_TASKS} | Monitor | Track all running tasks |
| ${TOOL_NAMES.CANCEL_TASK} | Stop agent | Cancel stuck tasks |
| ${TOOL_NAMES.RUN_BACKGROUND} | Shell cmd | Long builds/tests |
| ${TOOL_NAMES.CHECK_BACKGROUND} | Cmd status | Check command output |
</tools>`;
