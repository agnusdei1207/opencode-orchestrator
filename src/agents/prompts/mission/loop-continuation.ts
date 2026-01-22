/**
 * Commander Loop Continuation
 * 
 * Logic for reading shared state and continuing work loop.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS, WORK_STATUS, STATUS_LABEL } from "../../../shared/index.js";

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

