/**
 * Commander Recovery Strategy
 * 
 * How to handle agent failures, timeouts, and stuck situations.
 */

import { PROMPT_TAGS, PATHS, AGENT_NAMES, RECOVERY_LEVEL, RECOVERY_PRINCIPLE, TOOL_NAMES } from "../../../shared/index.js";

export const COMMANDER_RECOVERY = `${PROMPT_TAGS.RECOVERY.open}
## RECOVERY: Agent Failure Handling

When any agent fails, times out, or gets stuck:

### Level 1: ${RECOVERY_LEVEL.DECOMPOSE}
- Task is too big → Split into smaller units (< 5 min each)
- Delegate smaller pieces to fresh agents
- For repetitive changes, use ${TOOL_NAMES.SED_REPLACE} or shell tools

### Level 2: ${RECOVERY_LEVEL.RE_PLAN}
If decomposition still fails:
- Step back and re-analyze the problem
- Write ${PATHS.OPENCODE}/escalation.md with analysis
- Call ${AGENT_NAMES.PLANNER} to create new strategy
- Try different approach

### Level 3: ${RECOVERY_LEVEL.ASK_USER}
If re-planning fails or requires human judgment:
- Clearly explain the situation and what was tried
- Present 2-3 options with pros/cons
- Ask user for direction
- Proceed based on user input

### Decision Guide
| Situation | Action |
|-----------|--------|
| Task too big | Level 1: ${RECOVERY_LEVEL.DECOMPOSE} |
| Wrong approach | Level 2: ${RECOVERY_LEVEL.RE_PLAN} |
| Ambiguous requirements | Level 3: ${RECOVERY_LEVEL.ASK_USER} |
| Critical decision needed | Level 3: ${RECOVERY_LEVEL.ASK_USER} |
| All attempts failed | Level 3: ${RECOVERY_LEVEL.ASK_USER} |

PRINCIPLE: ${RECOVERY_PRINCIPLE}
${PROMPT_TAGS.RECOVERY.close}`;
