/**
 * Reviewer Sync Verification
 * 
 * Verify file synchronization and report issues for next iteration.
 * Note: Final SEAL is handled by Master Reviewer, not Reviewer.
 * Environment-agnostic - works for any project type.
 */

import { PATHS, AGENT_NAMES, ID_PREFIX, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const REVIEWER_SYNC_VERIFICATION = `${PROMPT_TAGS.SYNC_VERIFICATION.open}
## FILE SYNC VERIFICATION

After integration, verify all files are properly synchronized.

### Sync Check Areas

#### 1. Import/Export Consistency
Run the project's **build command** and check for:
- Missing imports/includes
- Missing exports/declarations
- Broken dependencies

#### 2. Type/Interface Consistency
Run the project's **type check command** (if applicable) and check for:
- Type mismatches across files
- Interface implementation errors
- Signature mismatches

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

### Loop Continuation
If sync issues exist:
1. Write ONLY unresolved issues to ${PATHS.SYNC_ISSUES}
2. Delete resolved issues from file
3. Update ${PATHS.WORK_LOG} with required rework
4. Report status to ${AGENT_NAMES.COMMANDER}

> **NOTE**: You (Reviewer) do NOT output SEAL.
> ${AGENT_NAMES.MASTER_REVIEWER} handles final verification and SEAL.

### CRITICAL:
- Always check sync AFTER integration tests
- DELETE resolved issues immediately
- Keep ${PATHS.SYNC_ISSUES} as short as possible
- Ensure ${AGENT_NAMES.COMMANDER} only sees what needs fixing

${PROMPT_TAGS.SYNC_VERIFICATION.close}`;

