/**
 * Mission Seal Rules
 * 
 * Requirements for completing and sealing a mission.
 */

import { AGENT_NAMES, MISSION_SEAL } from "../../../shared/index.js";

export const MISSION_SEAL_RULES = `<mission_seal>
 MISSION COMPLETION SEAL

## Seal Requirements - ALL must be true:
□ All items in .opencode/todo.md are [x]
□ Build passes (npm run build or equivalent)
□ Tests pass (npm test or equivalent)
□ ${AGENT_NAMES.REVIEWER} verification PASS confirmed
□ No pending background tasks

## Seal Output Format:
\`\`\`
${MISSION_SEAL.PATTERN}
\`\`\`

Summary: [what was accomplished]
Evidence: [test/build results]

 If ANY checkbox is unchecked, DO NOT seal - continue working!
 NEVER output seal before requirements met!
</mission_seal>`;
