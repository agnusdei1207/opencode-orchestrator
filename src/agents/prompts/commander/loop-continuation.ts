/**
 * Commander Loop Continuation
 * 
 * Logic for reading shared state and continuing work loop.
 */

import { PATHS, AGENT_NAMES, MISSION_SEAL, PROMPT_TAGS, WORK_STATUS, STATUS_LABEL } from "../../../shared/index.js";

export const COMMANDER_LOOP_CONTINUATION = `${PROMPT_TAGS.LOOP_CONTINUATION.open}
## LOOP CONTINUATION PROTOCOL

At the START of each loop iteration, ${AGENT_NAMES.COMMANDER} MUST read shared state:

### Step 1: Read Status Summary
\`\`\`bash
cat ${PATHS.STATUS} 2>/dev/null || echo "No status yet"
cat ${PATHS.TODO}
cat ${PATHS.SYNC_ISSUES} 2>/dev/null || echo "No sync issues"
\`\`\`

---

## MISSION STATUS TRACKING

${AGENT_NAMES.COMMANDER} updates ${PATHS.STATUS} each loop:
\`\`\`markdown
# Mission Status

## Progress
- ${PATHS.TODO}: [N]/[Total] ([X]%)
- Issues: [N] unresolved
- ${AGENT_NAMES.WORKER}s: [N] active
- E2E: ${WORK_STATUS.E2E_STATUS.NOT_STARTED} | ${WORK_STATUS.E2E_STATUS.RUNNING} | ${WORK_STATUS.E2E_STATUS.PASS} | ${WORK_STATUS.E2E_STATUS.FAIL}

## Current Phase
...
\`\`\`

---

## SEALED CONDITIONS (CRITICAL!)

### SEALED = BOTH must be true:
\`\`\`
${STATUS_LABEL.SUCCESS.toUpperCase()} ${PATHS.TODO}:        ALL items [x] (100%)
${STATUS_LABEL.SUCCESS.toUpperCase()} ${PATHS.SYNC_ISSUES}: EMPTY (0 issues)
───────────────────────────────────
ONLY THEN → output ${MISSION_SEAL.PATTERN}
\`\`\`

### LOOP BACK = ANY of these:
\`\`\`
${STATUS_LABEL.FAIL.toUpperCase()} ${PATHS.TODO} < 100% → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} ${PATHS.SYNC_ISSUES} > 0 → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} Build fails → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} E2E = ${WORK_STATUS.E2E_STATUS.FAIL} → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} Agent timeout/stuck → DECOMPOSE per ${PROMPT_TAGS.RECOVERY.open} and LOOP
\`\`\`

---

## E2E Test Timing

E2E starts when **${PATHS.TODO} ≥ 80%**:
...

### Decision Matrix

| ${PATHS.TODO} % | ${PATHS.SYNC_ISSUES} | Phase |
|--------|--------|-------|
| < 100% | Any | ${WORK_STATUS.PHASE.IMPLEMENTATION} |
| ≥ 80% | Any | ${WORK_STATUS.PHASE.E2E} (parallel) |
| 100% | > 0 | ${WORK_STATUS.PHASE.FIXING} |
| 100% | 0 | ${WORK_STATUS.PHASE.SEALING} (${STATUS_LABEL.SUCCESS.toUpperCase()}) |

...
${PROMPT_TAGS.LOOP_CONTINUATION.close}

`;

