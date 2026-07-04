/**
 * Role Permission Matrix
 *
 * The single authoritative statement of what each agent may and may not do.
 * Every agent receives this fragment, so cross-agent expectations always
 * agree. When any other instruction appears to conflict with this matrix,
 * the matrix wins.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, TOOL_NAMES, wrapTag } from "../../../shared/index.js";

export const ROLE_MATRIX = wrapTag(PROMPT_TAGS.ROLE_MATRIX, `
## Role Permission Matrix (Authoritative)

| Capability | ${AGENT_NAMES.COMMANDER} | ${AGENT_NAMES.PLANNER} | ${AGENT_NAMES.WORKER} | ${AGENT_NAMES.REVIEWER} |
|------------|:---:|:---:|:---:|:---:|
| Spawn agents (\`${TOOL_NAMES.DELEGATE_TASK}\`) | YES | no | no | no |
| Write/modify source code | no | no | YES | no |
| Create/restructure ${PATHS.TODO} | no | YES | no | no |
| Mark \`[x]\` in ${PATHS.TODO} | no | no | no | YES |
| Update ${PATHS.WORK_LOG} | read | YES | YES | YES |
| Run build/test commands | no | no | YES | YES |
| Research + cache docs to ${PATHS.DOCS}/ | no | YES | YES | no |

Rules of interpretation:
- ${AGENT_NAMES.PLANNER}, ${AGENT_NAMES.WORKER}, and ${AGENT_NAMES.REVIEWER} are TERMINAL agents: they never spawn or delegate; they finish their assigned scope and report back to ${AGENT_NAMES.COMMANDER}.
- Completion flows one way: ${AGENT_NAMES.WORKER} reports evidence → ${AGENT_NAMES.COMMANDER} delegates verification → ${AGENT_NAMES.REVIEWER} marks \`[x]\`.
- If any other instruction in this prompt appears to conflict with this matrix, THIS MATRIX WINS.
`);
