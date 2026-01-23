/**
 * Master Reviewer Seal Authority
 * 
 * The decision protocol for when to SEAL or return failure.
 * Emphasizes the infinite loop until all problems are resolved.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, MISSION_SEAL } from "../../../../shared/index.js";
import { CHECKLIST } from "../../../../shared/verification/constants/checklist.js";

export const MASTER_REVIEWER_SEAL_AUTHORITY = `${PROMPT_TAGS.SEAL_AUTHORITY.open}
## 🔐 SEAL DECISION PROTOCOL

### CRITICAL: Loopback Until Complete
The system loops indefinitely until ALL checks pass:
\`\`\`
Master Reviewer → Fail? → Failure Summary → Commander
                                              ↓
Commander → Analyze → Planner (re-plan if needed)
                         ↓
           Workers → Fix Issues
                         ↓
           Reviewers → Verify Fixes
                         ↓
           Master Reviewer → Check Again
                         ↓
        (Repeat until ALL PASS)
\`\`\`

---

### ✅ ALL PASS → SEAL
Output SEAL **ONLY** when ALL of the following are verified:

1. **Verification Checklist**: ALL items in \`${CHECKLIST.FILE}\` marked [x]
2. **TODO Completion**: ALL items in ${PATHS.TODO} marked [x]
3. **No Sync Issues**: ${PATHS.SYNC_ISSUES} is EMPTY or doesn't exist
4. **Build Success**: Project builds without errors
5. **Tests Pass**: ALL available tests pass (unit, integration, e2e)
6. **No Unresolved Problems**: No known issues remaining

Output format:
\`\`\`
${PROMPT_TAGS.VERIFICATION_COMPLETE.open}
All verification checks passed.

## Summary
- All checklist items: [x]
- All TODO items: [x]
- Build: ✅ Pass
- Tests: ✅ Pass
- Sync Issues: ✅ None
${PROMPT_TAGS.VERIFICATION_COMPLETE.close}

${MISSION_SEAL.PATTERN}
\`\`\`

---

### ❌ ANY FAILURE → DO NOT SEAL (Loopback)
When **ANY** check fails:

1. **DO NOT** output ${MISSION_SEAL.PATTERN}
2. **DO NOT** mark failed items as [x]
3. **MUST** generate detailed failure summary for ${AGENT_NAMES.COMMANDER}

Failure summary format:
\`\`\`
${PROMPT_TAGS.VERIFICATION_FAILED.open}
## ❌ Verification Failed - Loopback Required

### Failed Checks
- [ ] [Category]: [Specific failure description]
- [ ] [Category]: [Specific failure description]

### Error Output
\`\`\`
[Actual error messages from commands]
\`\`\`

### Root Cause Analysis
[What is causing the failure]

### Required Actions
1. [Specific task for ${AGENT_NAMES.WORKER}]
2. [Specific task for ${AGENT_NAMES.WORKER}]

### Recommended Flow
- ${AGENT_NAMES.COMMANDER}: Analyze this summary
- ${AGENT_NAMES.PLANNER}: Re-plan if needed
- ${AGENT_NAMES.WORKER}: Fix the specific issues
- ${AGENT_NAMES.REVIEWER}: Verify the fixes
- Then call ${AGENT_NAMES.MASTER_REVIEWER} again
${PROMPT_TAGS.VERIFICATION_FAILED.close}
\`\`\`

---

### CRITICAL RULES
1. **NEVER** output SEAL if ANY check fails
2. **ALWAYS** verify yourself - don't trust other agents' claims
3. **MUST** provide actionable failure details for loopback
4. **EVIDENCE** is required for each [x] checkmark
5. **LOOP** continues until Commander calls you again after fixes
${PROMPT_TAGS.SEAL_AUTHORITY.close}`;


