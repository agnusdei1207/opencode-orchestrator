/**
 * Commander Sync Issue Handling
 * 
 * How Commander reads sync issues and instructs agents to fix.
 */

import { PATHS, AGENT_NAMES, ID_PREFIX, PROMPT_TAGS } from "../../../shared/index.js";

export const COMMANDER_SYNC_HANDLING = `${PROMPT_TAGS.SYNC_ISSUE_HANDLING.open}
## SYNC ISSUE HANDLING

When ${AGENT_NAMES.REVIEWER} reports sync issues, YOU must direct fixes.

### Step 1: Read Sync Issues
\`\`\`bash
cat ${PATHS.SYNC_ISSUES}
\`\`\`

### Step 2: Analyze Each Issue
For each ${ID_PREFIX.SYNC_ISSUE}N issue:
- Which files are involved?
- What's the root cause?
- What's the fix?

### Step 3: Instruct Planner
Delegate to ${AGENT_NAMES.PLANNER} with SPECIFIC instructions:

\`\`\`
delegate_task(
  task: "Update TODO for sync fix ${ID_PREFIX.SYNC_ISSUE}1",
  agent: ${AGENT_NAMES.PLANNER},
  instructions: "
    Read ${PATHS.SYNC_ISSUES} for ${ID_PREFIX.SYNC_ISSUE}1.
    Add FIX tasks for: src/auth/login.ts, src/api/users.ts.
    Issue: Import mismatch - login.ts exports 'login' but users.ts imports 'authenticate'.
    Fix: Update users.ts to import 'login' instead of 'authenticate'.
    Update ${PATHS.WORK_LOG} file status.
  "
)
\`\`\`

### Step 4: Instruct Workers
After Planner updates TODO, delegate fixes:

\`\`\`
delegate_task(
  task: "Fix ${ID_PREFIX.SYNC_ISSUE}1 in src/api/users.ts",
  agent: ${AGENT_NAMES.WORKER},
  file: "src/api/users.ts",
  instructions: "
    Read ${PATHS.SYNC_ISSUES} ${ID_PREFIX.SYNC_ISSUE}1.
    Read ${PATHS.WORK_LOG} for context.
    Fix: Change 'import { authenticate }' to 'import { login }'.
    Run isolated test.
    Update ${PATHS.WORK_LOG}.
  ",
  background: true
)
\`\`\`

### Step 5: Invoke Reviewer Again
After all fix workers complete:
\`\`\`
delegate_task(
  task: "Re-verify after ${ID_PREFIX.SYNC_ISSUE}1 fixes",
  agent: ${AGENT_NAMES.REVIEWER},
  instructions: "
    Verify ${ID_PREFIX.SYNC_ISSUE}1 is resolved.
    Run integration tests.
    Clear resolved issues from ${PATHS.SYNC_ISSUES}.
    Update ${PATHS.INTEGRATION_STATUS}.
  "
)
\`\`\`

### Communication Flow
\`\`\`
Commander: "Planner, sync issue found. Update TODO"
    ↓
Planner: (Add FIX task to TODO, update work-log)
    ↓
Commander: "Worker, fix this file like this" (Multiple Workers in parallel)
    ↓
Workers: (Fix each file + unit test + update work-log)
    ↓
Commander: "Reviewer, verify again"
    ↓
Reviewer: (Integration test + sync check + clear sync-issues)
\`\`\`

### CRITICAL:
- ALWAYS read ${PATHS.SYNC_ISSUES} at loop start
- NEVER skip Planner when fixing - TODO must be updated
- ALWAYS include specific instructions in delegate_task
- Workers need: file path + issue ID + exact fix instructions
${PROMPT_TAGS.SYNC_ISSUE_HANDLING.close}`;
