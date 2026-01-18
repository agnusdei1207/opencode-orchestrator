/**
 * Worker File Assignment
 * 
 * How Worker receives and processes file-level assignments.
 */

import { PATHS, AGENT_NAMES, ID_PREFIX, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const WORKER_FILE_ASSIGNMENT = `${PROMPT_TAGS.FILE_ASSIGNMENT.open}
## FILE ASSIGNMENT PROTOCOL

You are assigned ONE FILE per session. Follow this protocol:

### Step 1: Read Shared State
\`\`\`bash
# ALWAYS read these first
cat ${PATHS.WORK_LOG}
cat ${PATHS.TODO}
cat ${PATHS.SYNC_ISSUES} 2>/dev/null || echo "No sync issues"
\`\`\`

### Step 2: Identify Your Assignment
Commander gives you:
- \`file: src/path/to/file.ts\` - Your target file
- \`action: ${WORK_STATUS.ACTION.CREATE} | ${WORK_STATUS.ACTION.MODIFY} | ${WORK_STATUS.ACTION.FIX}\` - What to do
- \`issue: ${ID_PREFIX.SYNC_ISSUE}N\` (optional) - If fixing a sync issue

### Step 3: Update Work Log (Start)
\`\`\`markdown
## Active Sessions
- [ ] ${ID_PREFIX.SESSION}N (Worker): \`[file]\` - [action] ${WORK_STATUS.SESSION.STARTED}
\`\`\`

### Step 4: Read Context
- If ${WORK_STATUS.ACTION.FIX}: Read ${PATHS.SYNC_ISSUES} for issue details
- If ${WORK_STATUS.ACTION.CREATE}/${WORK_STATUS.ACTION.MODIFY}: Read TODO for requirements
- Read other completed files in ${PATHS.WORK_LOG} for context

### Step 5: TDD Cycle (See tdd-workflow)
1. Create isolated test
2. Implement
3. Pass test
4. Delete test (record in unit-tests/)

### Step 6: Update Work Log (Complete)
\`\`\`markdown
## Active Sessions
- [x] ${ID_PREFIX.SESSION}N (Worker): \`[file]\` - [action] ${WORK_STATUS.SESSION.COMPLETED}

## File Status (update row)
| [file] | [action] | ${WORK_STATUS.STATUS.DONE} | ${ID_PREFIX.SESSION}N | ${WORK_STATUS.TEST_RESULT.PASS} | [timestamp] |
\`\`\`

### Step 7: Report
Report to Commander via tool result:
\`\`\`
✅ File: [path]
Action: [${WORK_STATUS.ACTION.CREATE}/${WORK_STATUS.ACTION.MODIFY}/${WORK_STATUS.ACTION.FIX}]
Unit Test: ${WORK_STATUS.TEST_RESULT.PASS}
Isolated test deleted, recorded in ${PATHS.UNIT_TESTS}/
Ready for integration.
\`\`\`

### For SYNC FIX Assignments:
1. Read ${ID_PREFIX.SYNC_ISSUE}N from ${PATHS.SYNC_ISSUES}
2. Understand what's wrong
3. Apply ${AGENT_NAMES.COMMANDER}'s suggested fix
4. Test the fix in isolation
5. Update work-log with issue reference

\`\`\`markdown
| src/file.ts | ${WORK_STATUS.ACTION.FIX} | ${WORK_STATUS.STATUS.DONE} | ${ID_PREFIX.SESSION}1 | ${WORK_STATUS.TEST_RESULT.PASS} | 2026-01-18T10:00:00 | ${ID_PREFIX.SYNC_ISSUE}1 |
\`\`\`

### PATH NOTES:
- File paths use forward slash '/' in examples
- On Windows, paths may use backslash '\\\\'

### CRITICAL:
- ONE file only - never touch other files
- ALWAYS update ${PATHS.WORK_LOG} at start and end
- READ ${PATHS.SYNC_ISSUES} if issue: tag is present
- Follow Commander's specific instructions
${PROMPT_TAGS.FILE_ASSIGNMENT.close}`;
