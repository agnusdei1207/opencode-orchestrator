/**
 * Planner TODO Sync
 * 
 * Syncs TODO list based on Commander instructions after sync issues.
 */

import { PATHS, AGENT_NAMES, ID_PREFIX, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_TODO_SYNC = `${PROMPT_TAGS.TODO_SYNC.open}
## TODO SYNC (After Sync Issues)

When ${AGENT_NAMES.COMMANDER} detects sync issues, you update the TODO.

### Step 1: Read Current State
\`\`\`bash
cat ${PATHS.SYNC_ISSUES}
cat ${PATHS.WORK_LOG}
cat ${PATHS.TODO}
\`\`\`

### Step 2: Understand Commander's Instructions
Commander will tell you:
- Which files need rework
- What sync issues to fix
- New dependencies discovered

### Step 3: Update TODO
Add NEW subtasks for sync fixes:

\`\`\`markdown
### T3: Sync Fixes | parallel-group:3 | depends:T2
- [ ] S3.1: ${WORK_STATUS.ACTION.FIX} \`src/auth/login.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/auth/login.ts | issue:${ID_PREFIX.SYNC_ISSUE}1
- [ ] S3.2: ${WORK_STATUS.ACTION.FIX} \`src/api/users.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/api/users.ts | issue:${ID_PREFIX.SYNC_ISSUE}1
\`\`\`

### Step 4: Update Work Log File Status
\`\`\`markdown
| src/auth/login.ts | ${WORK_STATUS.ACTION.FIX} | ${WORK_STATUS.STATUS.PENDING} | - | - | - | ${ID_PREFIX.SYNC_ISSUE}1 |
\`\`\`

### Sync Issue Reference Format
Always reference the sync issue ID:
- \`issue:${ID_PREFIX.SYNC_ISSUE}N\` in TODO subtask (e.g., ${ID_PREFIX.SYNC_ISSUE}1, ${ID_PREFIX.SYNC_ISSUE}42)
- Links back to ${PATHS.SYNC_ISSUES} for context

### CRITICAL:
- DO NOT remove completed tasks (keep for history)
- ADD new fix tasks, don't overwrite
- Keep file manifest updated
- Commander reads your updates in next loop
${PROMPT_TAGS.TODO_SYNC.close}`;
