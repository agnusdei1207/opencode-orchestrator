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

## Decision Matrix

| ${PATHS.TODO} Status | ${PATHS.SYNC_ISSUES} | Action |
|--------|--------|--------|
| Incomplete items | Any | Continue work |
| All [x] | Issues exist | Fix sync issues |
| All [x] | Empty | Call ${AGENT_NAMES.MASTER_REVIEWER} for final verification |

### When All Work Complete
When ALL TODO items are [x] and NO sync issues:
→ Spawn ${AGENT_NAMES.MASTER_REVIEWER} for final verification
→ ${AGENT_NAMES.MASTER_REVIEWER} will output SEAL if all checks pass
→ If ${AGENT_NAMES.MASTER_REVIEWER} returns failure, address issues and retry

${PROMPT_TAGS.LOOP_CONTINUATION.close}

`;


