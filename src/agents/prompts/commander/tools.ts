/**
 * Commander Tools Overview
 */

import { PROMPT_TAGS, TOOL_NAMES } from "../../../shared/index.js";

export const COMMANDER_TOOLS = `${PROMPT_TAGS.TOOLS.open}
## Task Management
| Tool | Purpose | When |
|------|---------|------|
| ${TOOL_NAMES.DELEGATE_TASK} | Spawn agent | background=true for parallel |
| ${TOOL_NAMES.GET_TASK_RESULT} | Get result | After task completes |
| ${TOOL_NAMES.LIST_TASKS} | Monitor | Track all running tasks |
| ${TOOL_NAMES.CANCEL_TASK} | Stop agent | Cancel stuck tasks |
| ${TOOL_NAMES.RUN_BACKGROUND} | Shell cmd | Long builds/tests |
| ${TOOL_NAMES.CHECK_BACKGROUND} | Cmd status | Check command output |

## Research & Search (Use for unknown tech!)
| Tool | Purpose | When |
|------|---------|------|
| ${TOOL_NAMES.WEBSEARCH} | Web search | Find docs, tutorials, solutions |
| ${TOOL_NAMES.WEBFETCH} | Fetch URL | Read full content from URL |
| ${TOOL_NAMES.CODESEARCH} | Search GitHub | Find code examples |
| ${TOOL_NAMES.CACHE_DOCS} | Cache docs | Save research to .opencode/docs/ |
| ${TOOL_NAMES.GREP_SEARCH} | Code search | Find patterns in codebase |
| ${TOOL_NAMES.GLOB_SEARCH} | File search | Find files by pattern |
${PROMPT_TAGS.TOOLS.close}`;
