/**
 * Commander Loop Continuation
 * 
 * Logic for reading shared state and continuing work loop.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS } from "../../../shared/index.js";

export const COMMANDER_LOOP_CONTINUATION = `${PROMPT_TAGS.LOOP_CONTINUATION.open}
## LOOP CONTINUATION PROTOCOL

At the START of each loop iteration, Commander MUST read shared state:

### Step 1: Read Work Status
\`\`\`bash
# Check current work status
cat ${PATHS.WORK_LOG}
\`\`\`

### Step 2: Check for Sync Issues
\`\`\`bash
# Check if Reviewer reported sync issues
cat ${PATHS.SYNC_ISSUES} 2>/dev/null || echo "No sync issues"
\`\`\`

### Step 3: Check Integration Status
\`\`\`bash
# Check integration test results
cat ${PATHS.INTEGRATION_STATUS} 2>/dev/null || echo "No integration yet"
\`\`\`

### Step 4: Decision Matrix

| work-log.md | sync-issues.md | Action |
|-------------|----------------|--------|
| Active workers | Any | Wait, monitor progress |
| All [x] | Empty | Proceed to SEAL check |
| All [x] | Has issues | Dispatch ${AGENT_NAMES.WORKER} to fix |
| Has unchecked | Any | Continue execution |

### Step 5: File-Level Task Assignment
When dispatching work, assign at FILE LEVEL:
\`\`\`markdown
## TODO Format for Parallel Workers:
- [ ] S1.1: Implement \`src/auth/login.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/auth/login.ts
- [ ] S1.2: Implement \`src/auth/logout.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/auth/logout.ts
\`\`\`

Each ${AGENT_NAMES.WORKER} gets ONE file:
- Isolation guaranteed
- TDD happens per file
- Unit test created & deleted per file

### Step 6: Parallel Dispatch
\`\`\`
delegate_task(S1.1, ${AGENT_NAMES.WORKER}, background: true)
delegate_task(S1.2, ${AGENT_NAMES.WORKER}, background: true)
delegate_task(S1.3, ${AGENT_NAMES.WORKER}, background: true)
// All run in PARALLEL
\`\`\`

### Step 7: After Workers Complete
\`\`\`
delegate_task(VERIFY_ALL, ${AGENT_NAMES.REVIEWER}, background: false)
// Reviewer checks all completed units
// Reviewer runs integration test
// Reviewer updates TODO or reports sync issues
\`\`\`

### CRITICAL LOOP RULES:
- ALWAYS read ${PATHS.WORK_LOG} at loop start
- NEVER seal with active workers
- NEVER seal with unresolved sync issues
- File-level assignment = proper isolation
${PROMPT_TAGS.LOOP_CONTINUATION.close}`;

