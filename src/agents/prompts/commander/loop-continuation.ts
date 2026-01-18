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
cat ${PATHS.WORK_LOG}
cat ${PATHS.TODO}
\`\`\`

### Step 2: Check for Sync Issues
\`\`\`bash
cat ${PATHS.SYNC_ISSUES} 2>/dev/null || echo "No sync issues"
\`\`\`

---

## ⚠️ SEALED CONDITIONS (CRITICAL!)

### SEALED = BOTH must be true:
\`\`\`
✅ TODO:        ALL items [x] checked
✅ sync-issues: EMPTY (no unresolved issues)
───────────────────────────────────
ONLY THEN → output <mission_seal>SEALED</mission_seal>
\`\`\`

### LOOP BACK = ANY of these:
\`\`\`
❌ TODO has unchecked items → LOOP
❌ sync-issues.md is NOT empty → LOOP
❌ Build fails → LOOP
❌ E2E test fails → LOOP
\`\`\`

### ⛔ NEVER SEAL IF:
- TODO is complete BUT sync-issues has content
- Workers are still active
- Build or E2E tests failed

---

## 🔄 E2E Test Timing

E2E tests start when **TODO is nearly complete** (not at the very end):
- Reviewer begins E2E when most tasks are done
- E2E runs **parallel** with remaining TODO items
- If E2E finds errors → record in sync-issues.md → continue with TODO
- This allows catching integration issues early

\`\`\`
Timeline:
[---TODO progress---] [E2E starts here---]
                      ↓
            TODO + E2E run in parallel
                      ↓
        Both must complete cleanly → SEALED
\`\`\`

---

### Decision Matrix

| TODO | sync-issues.md | Action |
|------|----------------|--------|
| Has unchecked | Any | Continue work |
| All [x] | NOT empty | ♻️ LOOP - fix issues first |
| All [x] | Empty | ✅ SEALED |

### File-Level Task Assignment
Each ${AGENT_NAMES.WORKER} gets ONE file for isolation:
\`\`\`
delegate_task(file:src/auth/login.ts, ${AGENT_NAMES.WORKER}, background: true)
delegate_task(file:src/auth/logout.ts, ${AGENT_NAMES.WORKER}, background: true)
\`\`\`

### CRITICAL RULES:
- ALWAYS read ${PATHS.TODO} AND ${PATHS.SYNC_ISSUES} at loop start
- NEVER seal with sync-issues content (even if TODO is done!)
- NEVER seal with active workers
- E2E starts near TODO completion, runs parallel
${PROMPT_TAGS.LOOP_CONTINUATION.close}`;
