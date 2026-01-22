/**
 * Reviewer Sync Verification
 * 
 * Verify file synchronization and report issues for next iteration.
 */

import { PATHS, AGENT_NAMES, ID_PREFIX, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const REVIEWER_SYNC_VERIFICATION = `${PROMPT_TAGS.SYNC_VERIFICATION.open}
## FILE SYNC VERIFICATION

After integration, verify all files are properly synchronized.

### Sync Check Areas

#### 1. Import/Export Consistency
\`\`\`bash
# Check for broken imports
npm run build 2>&1 | grep -i "cannot find"
npm run build 2>&1 | grep -i "not exported"
\`\`\`

#### 2. Type Consistency
\`\`\`bash
# Check for type mismatches
npx tsc --noEmit 2>&1 | grep -i "type"
\`\`\`

#### 3. Interface Implementation
- Check implemented interfaces match declarations
- Verify function signatures match calls

#### 4. Shared State Consistency
- Check constants used across files
- Verify shared types are consistent

---

## ISSUE MANAGEMENT RULES (CRITICAL)

### ${PATHS.SYNC_ISSUES} Contains UNRESOLVED ONLY
- **Delete resolved issues immediately** (keep file clean)
- **Keep only unresolved** (only what ${AGENT_NAMES.COMMANDER} needs to read)
- **Summarize if too long** (archive old issues)

### Issue Format (Minimal)
\`\`\`markdown
# Sync Issues (Unresolved Only)

## ${ID_PREFIX.SYNC_ISSUE}N
- Severity: ${WORK_STATUS.SEVERITY.HIGH}
- Files: src/file1.ts ↔ src/file2.ts
- Problem: [concise description]
- Fix: [specific solution]
- Status: ${WORK_STATUS.STATUS.PENDING}
\`\`\`

### After Fix Verification
When re-verifying after fixes:
1. Check if issue is resolved
2. If resolved: **DELETE the issue from ${PATHS.SYNC_ISSUES}**
3. If not resolved: Update issue status, add notes
4. Keep file minimal

---

### Loop Continuation (NOT SEALED)
If sync issues exist:
1. Write ONLY unresolved issues to ${PATHS.SYNC_ISSUES}
2. Delete resolved issues from file
3. Update ${PATHS.WORK_LOG} with required rework
4. DO NOT output SEALED
5. ${AGENT_NAMES.COMMANDER} will read and dispatch new work

### Seal Condition
Output SEALED only when:
- [ ] All TODO items [x]
- [ ] Build passes
- [ ] All tests pass (${WORK_STATUS.TEST_RESULT.PASS})
- [ ] ${PATHS.SYNC_ISSUES} is EMPTY (no unresolved issues)
- [ ] ${PATHS.INTEGRATION_STATUS} shows ${WORK_STATUS.TEST_RESULT.PASS}

### CRITICAL:
- Always check sync AFTER integration tests
- DELETE resolved issues immediately
- Keep ${PATHS.SYNC_ISSUES} as short as possible
- Ensure ${AGENT_NAMES.COMMANDER} only sees what needs fixing

${PROMPT_TAGS.SYNC_VERIFICATION.close}`;
