/**
 * Commander Loop Continuation
 * 
 * Logic for reading shared state and continuing work loop.
 */

import { PATHS, AGENT_NAMES, MISSION_SEAL, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

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
- ${PATHS.TODO}: 8/10 (80%)
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
- ${AGENT_NAMES.PLANNER} reads this to stay synced
- Delete old content, keep only current state

---

## ⚠️ SEALED CONDITIONS (CRITICAL!)

### SEALED = BOTH must be true:
\`\`\`
✅ ${PATHS.TODO}:        ALL items [x] (100%)
✅ ${PATHS.SYNC_ISSUES}: EMPTY (0 issues)
───────────────────────────────────
ONLY THEN → output ${MISSION_SEAL.PATTERN}
\`\`\`

### LOOP BACK = ANY of these:
\`\`\`
❌ ${PATHS.TODO} < 100% → LOOP
❌ ${PATHS.SYNC_ISSUES} > 0 → LOOP
❌ Build fails → LOOP
❌ E2E = ${WORK_STATUS.E2E_STATUS.FAIL} → LOOP
❌ Agent timeout/stuck → DECOMPOSE per ${PROMPT_TAGS.RECOVERY.open} and LOOP
\`\`\`

### ⛔ NEVER SEAL IF:
- ${PATHS.TODO} is 100% BUT ${PATHS.SYNC_ISSUES} > 0
- Workers are still active
- E2E = ${WORK_STATUS.E2E_STATUS.FAIL}

---

## 🔄 E2E Test Timing

E2E starts when **${PATHS.TODO} ≥ 80%** (not at 100%):
- Phase changes to ${WORK_STATUS.PHASE.E2E}
- E2E runs **parallel** with remaining work
- If E2E ${WORK_STATUS.E2E_STATUS.FAIL} → ${PATHS.SYNC_ISSUES}++ → continue ${PATHS.TODO}
- Both ${PATHS.TODO} 100% AND ${PATHS.SYNC_ISSUES} 0 → ${WORK_STATUS.PHASE.SEALING}

\`\`\`
[---${PATHS.TODO} progress---][E2E starts ~80%]
                           ↓
               ${PATHS.TODO} + E2E run parallel
                           ↓
         ${PATHS.TODO} 100% + ${PATHS.SYNC_ISSUES} 0 → ${MISSION_SEAL.CONFIRMATION}
\`\`\`

---

### Decision Matrix

| ${PATHS.TODO} % | ${PATHS.SYNC_ISSUES} | Phase |
|--------|--------|-------|
| < 100% | Any | ${WORK_STATUS.PHASE.IMPLEMENTATION} |
| ≥ 80% | Any | ${WORK_STATUS.PHASE.E2E} (parallel) |
| 100% | > 0 | ${WORK_STATUS.PHASE.FIXING} |
| 100% | 0 | ${WORK_STATUS.PHASE.SEALING} ✅ |

### CRITICAL RULES:
- Update ${PATHS.STATUS} every loop
- ${AGENT_NAMES.PLANNER} keeps docs minimal
- NEVER seal with ${PATHS.SYNC_ISSUES} > 0
- E2E starts at ~80%, runs parallel
${PROMPT_TAGS.LOOP_CONTINUATION.close}`;

