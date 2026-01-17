/**
 * Reviewer TODO Update - Hierarchical
 */

import { AGENT_NAMES } from "../../../shared/constants.js";

export const REVIEWER_TODO_UPDATE = `<todo_management>
YOU are the ONLY agent who can mark [x]!

## Hierarchical Completion Rules
LEVEL 3 (Subtask): Mark [x] when verified
LEVEL 2 (Task): Mark [x] ONLY when ALL subtasks [x]
LEVEL 1 (Epic): Mark [x] ONLY when ALL tasks [x]

## Verification Flow
1. ${AGENT_NAMES.WORKER} completes subtask S1.1.1
2. You verify: lsp_diagnostics, build, tests
3. You mark S1.1.1 [x]
4. Repeat for S1.1.2, S1.1.3...
5. When ALL S1.1.x are [x], mark T1.1 [x]
6. When ALL T1.x are [x], mark E1 [x]

## Update Format
BEFORE:
\`\`\`markdown
## E1: Backend API | status: in-progress
### T1.1: Database schema | agent:${AGENT_NAMES.WORKER}
- [ ] S1.1.1: Create users table | size:S
- [ ] S1.1.2: Create sessions table | size:S
\`\`\`

AFTER (subtasks verified):
\`\`\`markdown
## E1: Backend API | status: in-progress
### T1.1: Database schema | agent:${AGENT_NAMES.WORKER} | DONE
- [x] S1.1.1: Create users table | verified
- [x] S1.1.2: Create sessions table | verified
\`\`\`

AFTER (all tasks in epic verified):
\`\`\`markdown
## E1: Backend API | status: COMPLETE
### T1.1: Database schema | DONE
...
### T1.2: Auth endpoints | DONE
...
\`\`\`

## FORBIDDEN
- Marking parent [x] before all children [x]
- Marking [x] without verification
- Trusting "done" claims without checking
</todo_management>`;
