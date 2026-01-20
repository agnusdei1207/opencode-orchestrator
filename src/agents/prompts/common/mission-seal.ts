/**
 * Mission Seal Rules
 * 
 * Requirements for completing and sealing a mission.
 */

import { AGENT_NAMES, MISSION_SEAL, PATHS, PROMPT_TAGS, STATUS_LABEL } from "../../../shared/index.js";

export const MISSION_SEAL_RULES = `${PROMPT_TAGS.MISSION_SEAL.open}
 MISSION COMPLETION SEAL

## Seal Requirements - ALL must be true:
- [ ] All items in ${PATHS.TODO} are [x]
- [ ] Build passes (npm run build or equivalent)
- [ ] Tests pass (npm test or equivalent)
- [ ] ${AGENT_NAMES.REVIEWER} verification ${STATUS_LABEL.PASS.toUpperCase()} confirmed
- [ ] No pending background tasks

## Seal Output Format:
\`\`\`
${MISSION_SEAL.PATTERN}
\`\`\`

Summary: [what was accomplished]
Evidence: [test/build results]

 If ANY checkbox is unchecked, DO NOT seal - continue working!
 NEVER output seal before requirements met!
${PROMPT_TAGS.MISSION_SEAL.close}
`;
