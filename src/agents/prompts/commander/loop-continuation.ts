/**
 * Commander Loop Continuation
 * 
 * Logic for reading shared state and continuing work loop.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const COMMANDER_LOOP_CONTINUATION = `${PROMPT_TAGS.LOOP_CONTINUATION.open}
## LOOP CONTINUATION PROTOCOL

At the START of each loop iteration, Commander MUST read shared state:

### Step 1: Read Status Summary
\`\`\`bash
cat ${PATHS.STATUS} 2>/dev/null || echo "No status yet"
cat ${PATHS.TODO}
cat ${PATHS.SYNC_ISSUES} 2>/dev/null || echo "No sync issues"
\`\`\`

---

## 📊 STATUS TRACKING

Commander updates ${PATHS.STATUS} each loop:
\`\`\`markdown
# Mission Status

## Progress
- TODO: 8/10 (80%)
- Issues: 2 unresolved
- Workers: 3 active
- E2E: ${WORK_STATUS.E2E_STATUS.NOT_STARTED} | ${WORK_STATUS.E2E_STATUS.RUNNING} | ${WORK_STATUS.E2E_STATUS.PASS} | ${WORK_STATUS.E2E_STATUS.FAIL}

## Current Phase
${WORK_STATUS.PHASE.PLANNING} | ${WORK_STATUS.PHASE.IMPLEMENTATION} | ${WORK_STATUS.PHASE.E2E} | ${WORK_STATUS.PHASE.FIXING} | ${WORK_STATUS.PHASE.SEALING}

## Next Action
[Brief description]

## Blockers
- [List or "None"]
\`\`\`

### Status Rules:
- Update EVERY loop iteration
- Keep it minimal (just the numbers)
- Planner reads this to stay synced
- Delete old content, keep only current state

---

## ⚠️ SEALED CONDITIONS (CRITICAL!)

### SEALED = BOTH must be true:
\`\`\`
✅ TODO:        ALL items [x] (100%)
✅ sync-issues: EMPTY (0 issues)
───────────────────────────────────
ONLY THEN → output <mission_seal>SEALED</mission_seal>
\`\`\`

### LOOP BACK = ANY of these:
\`\`\`
❌ TODO < 100% → LOOP
❌ Issues > 0 → LOOP
❌ Build fails → LOOP
❌ E2E = ${WORK_STATUS.E2E_STATUS.FAIL} → LOOP
\`\`\`

### ⛔ NEVER SEAL IF:
- TODO is 100% BUT issues > 0
- Workers are still active
- E2E = ${WORK_STATUS.E2E_STATUS.FAIL}

---

## 🔄 E2E Test Timing

E2E starts when **TODO ≥ 80%** (not at 100%):
- Phase changes to ${WORK_STATUS.PHASE.E2E}
- E2E runs **parallel** with remaining work
- If E2E ${WORK_STATUS.E2E_STATUS.FAIL} → issues++ → continue TODO
- Both TODO 100% AND issues 0 → ${WORK_STATUS.PHASE.SEALING}

\`\`\`
[---TODO progress---][E2E starts ~80%]
                           ↓
               TODO + E2E run parallel
                           ↓
         TODO 100% + Issues 0 → SEALED
\`\`\`

---

### Decision Matrix

| TODO % | Issues | Phase |
|--------|--------|-------|
| < 100% | Any | ${WORK_STATUS.PHASE.IMPLEMENTATION} |
| ≥ 80% | Any | ${WORK_STATUS.PHASE.E2E} (parallel) |
| 100% | > 0 | ${WORK_STATUS.PHASE.FIXING} |
| 100% | 0 | ${WORK_STATUS.PHASE.SEALING} ✅ |

### CRITICAL RULES:
- Update ${PATHS.STATUS} every loop
- Planner keeps docs minimal
- NEVER seal with issues > 0
- E2E starts at ~80%, runs parallel
${PROMPT_TAGS.LOOP_CONTINUATION.close}`;

