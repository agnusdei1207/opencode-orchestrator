/**
 * Reviewer Integration Testing
 * 
 * E2E testing when TODO is almost done or at the end.
 * Language-agnostic.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const REVIEWER_INTEGRATION_TESTING = `${PROMPT_TAGS.INTEGRATION_TESTING.open}
## E2E INTEGRATION TESTING

### ⚠️ E2E Test Timing (CRITICAL)
E2E tests should only run when:
1. **TODO is almost complete** - Most tasks checked [x]
2. **All Workers done** - No active sessions in work-log.md
3. **Or final verification** - Right before SEALED

### Pre-Integration Checklist
- [ ] Check ${PATHS.TODO} for incomplete tasks
- [ ] Check ${PATHS.WORK_LOG} for all workers [x] complete
- [ ] Check ${PATHS.UNIT_TESTS}/ for unit test records
- [ ] All isolated test files deleted

### Integration Workflow

#### Step 1: Check TODO Status
\`\`\`bash
cat ${PATHS.TODO}
# If incomplete items exist, wait for E2E
\`\`\`

#### Step 2: Run Build (language-appropriate)
\`\`\`bash
# Run project build command
# If failed, record in sync-issues.md
\`\`\`

#### Step 3: Run Full Tests
\`\`\`bash
# Run project test command
# Check for regressions
\`\`\`

#### Step 4: Write E2E Integration Test (if needed)
\`\`\`
# Write integration test in appropriate format
# Verify multiple files work together
# Unlike isolated tests, DO NOT delete
\`\`\`

#### Step 5: Record Results
Write to ${PATHS.INTEGRATION_STATUS}:
\`\`\`markdown
# Integration Status

## Last Integration
- Timestamp: [ISO timestamp]

## Result
- Build: ${WORK_STATUS.TEST_RESULT.PASS}/${WORK_STATUS.TEST_RESULT.FAIL}
- E2E Test: ${WORK_STATUS.TEST_RESULT.PASS}/${WORK_STATUS.TEST_RESULT.FAIL}

## Sync Issues Found
- (omit if none)
\`\`\`

---

## Loop Condition Check (Reviewer verifies)

### SEALED Conditions (all must be true)
- [ ] ${PATHS.TODO} all items [x]
- [ ] ${PATHS.SYNC_ISSUES} is empty
- [ ] Build passes
- [ ] E2E test passes

### LOOP BACK Conditions
- ${PATHS.TODO} has incomplete items → ♻️ LOOP
- ${PATHS.SYNC_ISSUES} has unresolved issues → ♻️ LOOP
- Build/test fails → record in sync-issues.md → ♻️ LOOP

### CRITICAL:
- E2E only at TODO completion time!
- Record build/test failures minimally in sync-issues.md
- Delete resolved issues, keep only unresolved
- All TODO [x] + no issues = SEALED!
${PROMPT_TAGS.INTEGRATION_TESTING.close}`;
