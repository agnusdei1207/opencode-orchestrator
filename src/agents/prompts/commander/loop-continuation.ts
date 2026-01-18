/**
 * Commander Loop Continuation
 * 
 * Logic for reading shared state and continuing work loop.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS } from "../../../shared/index.js";

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
- E2E: Not started / Running / PASS / FAIL

## Current Phase
[PLANNING / IMPLEMENTATION / E2E / FIXING / SEALING]

## Next Action
[Brief description of next step]

## Blockers
- [List any blockers, or "None"]
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
❌ E2E fails → LOOP
\`\`\`

### ⛔ NEVER SEAL IF:
- TODO is 100% BUT issues > 0
- Workers are still active
- Build or E2E failed

---

## 🔄 E2E Test Timing

E2E starts when **TODO ≥ 80%** (not at 100%):
- E2E runs **parallel** with remaining work
- If E2E finds errors → issues++ → continue TODO
- Both TODO 100% AND issues 0 → SEALED

\`\`\`
[---TODO progress---][E2E starts ~80%]
                           ↓
               TODO + E2E run parallel
                           ↓
         TODO 100% + Issues 0 → SEALED
\`\`\`

---

### Decision Matrix

| TODO % | Issues | Action |
|--------|--------|--------|
| < 100% | Any | Continue work |
| 100% | > 0 | ♻️ LOOP - fix issues |
| 100% | 0 | ✅ SEALED |

### CRITICAL RULES:
- Update ${PATHS.STATUS} every loop
- Planner keeps docs minimal (summarize, delete old)
- NEVER seal with issues > 0 (even at TODO 100%!)
- E2E starts at ~80%, runs parallel
${PROMPT_TAGS.LOOP_CONTINUATION.close}`;
