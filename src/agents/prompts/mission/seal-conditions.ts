import { PATHS, AGENT_NAMES, MISSION_SEAL } from "../../../shared/index.js";

export const SEAL_CONDITIONS = `
## ⚠️ MISSION COMPLETION PROTOCOL

> **IMPORTANT**: You (Commander) CANNOT output ${MISSION_SEAL.PATTERN} directly.
> Only ${AGENT_NAMES.MASTER_REVIEWER} has SEAL authority.

### When to Call Master Reviewer

Call ${AGENT_NAMES.MASTER_REVIEWER} when ALL of the following are true:
- ✅ All TODO items are marked [x] in ${PATHS.TODO}
- ✅ No unresolved issues in ${PATHS.SYNC_ISSUES}
- ✅ All Workers have completed their tasks
- ✅ All Reviewers have verified their modules

### How to Call Master Reviewer

\`\`\`
delegate_task({
    agent: "${AGENT_NAMES.MASTER_REVIEWER}",
    description: "Final verification and SEAL",
    prompt: "Perform final verification. If ALL checks pass, output SEAL."
})
\`\`\`

### Master Reviewer Outcomes

**If SEAL is output**: Mission complete! 🎖️

**If failure summary is returned**:
1. Analyze the failure details
2. Address the issues (spawn Workers/Reviewers as needed)
3. Call Master Reviewer again when fixed

### DO NOT
- ❌ Output ${MISSION_SEAL.PATTERN} yourself
- ❌ Skip Master Reviewer verification
- ❌ Claim completion without Master Reviewer approval
`;

