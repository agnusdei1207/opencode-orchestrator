/**
 * Reviewer Integration Testing
 * 
 * E2E testing when TODO is almost done or at the end.
 * Language-agnostic.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, WORK_STATUS, STATUS_LABEL } from "../../../shared/index.js";

export const REVIEWER_INTEGRATION_TESTING = `${PROMPT_TAGS.INTEGRATION_TESTING.open}
## E2E INTEGRATION TESTING RULES

### 1. Timing
Start when **${PATHS.TODO} ≥ 80%** (some Workers still active).

### 2. Pre-integration Checklist
Before running integration tests, all merged files must:
- [ ] Have clean lsp_diagnostics
- [ ] Have unit test passing records in ${PATHS.UNIT_TESTS}/
- [ ] Be listed in ${PATHS.WORK_LOG} "Pending Integration"

### Integration Workflow (Master Mode)

#### Step 0: Direct File Reading
Read all modified files directly from ${PATHS.WORK_LOG}. Identify:
- Cross-module interface changes
- Shared constant modifications
- Potential synchronization bottlenecks

[NOTE]: Read directly - no parallel scout overhead, saves tokens.

#### Step 1: Check ${PATHS.TODO} Status
\`\`\`bash
cat ${PATHS.TODO}
# If incomplete items exist, wait for E2E
\`\`\`

#### Step 2: Global Consistency Check
- Do all modules agree on shared types?
- Are imports/exports correctly synchronized across files?
- Record results in ${PATHS.SYNC_ISSUES}

#### Step 3: Run Build (language-appropriate)
\`\`\`bash
# Run project build command (from ${PATHS.CONTEXT})
# If failed, record in ${PATHS.SYNC_ISSUES}
\`\`\`

#### Step 4: Run Full Tests
\`\`\`bash
# Run project test command (from ${PATHS.CONTEXT})
# Check for regressions
\`\`\`

#### Step 5: Write E2E Integration Test (if needed)
- Write integration test in appropriate format
- Verify multiple files work together
- Unlike isolated tests, DO NOT delete

#### Step 6: Record Results
Write to ${PATHS.INTEGRATION_STATUS}:
\`\`\`markdown
# Integration Status

## Last Integration
- Timestamp: [ISO timestamp]

## Result
- Build: ${STATUS_LABEL.PASS}/${WORK_STATUS.TEST_RESULT.FAIL}
- E2E Test: ${STATUS_LABEL.PASS}/${WORK_STATUS.TEST_RESULT.FAIL}

## Sync Issues Found
- (omit if none)
\`\`\`

---

## Loop Condition Check (SYSTEM-VERIFIED)

> ⚠️ The orchestrator performs HARD VERIFICATION on every SEAL attempt.
> Premature SEAL = Automatic rejection + forced continuation.

### SEALED Conditions (all must be true - verified by system)
- [x] ${PATHS.TODO} all items [x] (system verifies)
- [x] ${PATHS.SYNC_ISSUES} is EMPTY (system verifies)
- [x] Build passes
- [x] E2E test passes

### LOOP BACK Conditions
- ${PATHS.TODO} has incomplete items → SEAL REJECTED → LOOP
- ${PATHS.SYNC_ISSUES} has unresolved issues → SEAL REJECTED → LOOP
- Build/test fails → record in ${PATHS.SYNC_ISSUES} → LOOP

**CRITICAL**:
- E2E only at ${PATHS.TODO} completion time!
- Read modified files directly for maximum efficiency.
- All ${PATHS.TODO} [x] + no issues = SEALED!
${PROMPT_TAGS.INTEGRATION_TESTING.close}`;

