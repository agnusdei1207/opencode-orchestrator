import { PATHS, AGENT_NAMES, VERIFICATION_SIGNALS } from "../../../shared/index.js";

export const COMPLETION_CONDITIONS = `
## ⚠️ MISSION COMPLETION PROTOCOL

> **IMPORTANT**: You (Commander) conclude the mission ONLY when every hierarchical task is verified.
> You must rely on ${AGENT_NAMES.REVIEWER} for the final quality gate.

### When to Conclude

Finalize only when ALL of the following are true:
- ✅ **Hierarchical Completeness**: Every milestone, task, and sub-task in ${PATHS.TODO} is marked [x].
- ✅ **Verified Outcome**: You have received confirmation from ${AGENT_NAMES.REVIEWER} that all tests and builds pass.
- ✅ **Zero Regression**: No unresolved issues in ${PATHS.SYNC_ISSUES}.

### Final Verification Workflow

1. **Unit Reviews**: As Workers complete Grade 3 sub-tasks, delegate to ${AGENT_NAMES.REVIEWER} for individual file/module verification.
2. **Integration Pass**: Once all segments are done, delegate a final "${VERIFICATION_SIGNALS.FINAL_PASS}" task to ${AGENT_NAMES.REVIEWER}.
3. **Execution Gate**: The Reviewer MUST run the full build and E2E test suite.
4. **Correction**: If Reviewer reports failure, address it immediately. Do not claim completion.

### Autonomous Loop Enforcement
- THE SYSTEM MONITOR: An autonomous process monitors ${PATHS.TODO} and ${PATHS.CONTEXT}.
- FORCED RESTART: If you attempt to stop while \`[ ]\` remain, the system will automatically inject a continuation prompt and increment the loop counter.
- RESOLUTION: You are only "released" when the system verifies 100% check-off of the hierarchical plan.

### DO NOT
- ❌ Declare mission success based on partial output.
- ❌ Stop if any Grade 1, 2, or 3 items are still \`[ ]\`.
- ❌ Skip the final integration build/test pass.
`;
