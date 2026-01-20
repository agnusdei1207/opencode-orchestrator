/**
 * Planner TODO Sync
 * 
 * Syncs TODO list based on Commander instructions after sync issues.
 * Also maintains .opencode/ documents minimal.
 */

import { PATHS, AGENT_NAMES, ID_PREFIX, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_TODO_SYNC = `${PROMPT_TAGS.TODO_SYNC.open}
## TODO SYNC & DOCUMENT MAINTENANCE

When ${AGENT_NAMES.COMMANDER} detects sync issues, you update TODO and maintain docs.

### Step 1: Read Current State
\`\`\`bash
cat ${PATHS.STATUS}         # Current progress %
cat ${PATHS.SYNC_ISSUES}    # Unresolved issues
cat ${PATHS.TODO}           # Task list
\`\`\`

### Step 2: Add Fix Tasks
Add NEW subtasks for sync fixes:
\`\`\`markdown
### T3: Sync Fixes | parallel-group:3
- [ ] S3.1: ${WORK_STATUS.ACTION.FIX} \`src/auth/login.ts\` | issue:${ID_PREFIX.SYNC_ISSUE}1
- [ ] S3.2: ${WORK_STATUS.ACTION.FIX} \`src/api/users.ts\` | issue:${ID_PREFIX.SYNC_ISSUE}1
\`\`\`

---

## 📋 DOCUMENT MAINTENANCE RULES

### Keep ${PATHS.OPENCODE}/ Minimal:
| File | Rule |
|------|------|
| ${PATHS.STATUS} | Overwrite each loop (no history) |
| ${PATHS.TODO} | Keep only uncompleted tasks |
| ${PATHS.SYNC_ISSUES} | Delete resolved issues immediately |
| ${PATHS.WORK_LOG} | Archive completed, keep active only |

### Summarize & Clean:
- **Completed tasks**: Move to archive or delete
- **Resolved issues**: DELETE from ${PATHS.SYNC_ISSUES.split("/").pop()}
- **Old status**: Overwrite with current (no append)
- **Long descriptions**: Summarize to 1-2 lines

### What to DELETE:
- Resolved sync issues
- Completed TODO items (mark [x] first, then remove in next cycle)
- Old status updates
- Verbose explanations

### What to KEEP:
- Active/pending tasks
- Unresolved issues
- Current phase info
- Blockers

### CRITICAL:
- ${AGENT_NAMES.COMMANDER} should NOT see old/resolved content
- Only current state matters

- Less context = faster decisions
${PROMPT_TAGS.TODO_SYNC.close}`;

