import { AGENT_NAMES, PATHS, WORK_STATUS } from "../../../shared/index.js";

export const MISSION_STATUS_FORMAT = `
# Mission Status

## Progress
- ${PATHS.TODO}: [N]/[Total] ([X]%)
- Issues: [N] unresolved
- ${AGENT_NAMES.WORKER}s: [N] active
- Verification Strategy: [High-level plan from ${AGENT_NAMES.REVIEWER}]
- Execution Status: ${WORK_STATUS.E2E_STATUS.NOT_STARTED} | ${WORK_STATUS.E2E_STATUS.RUNNING} | ${WORK_STATUS.E2E_STATUS.PASS} | ${WORK_STATUS.E2E_STATUS.FAIL}

## Current Phase
[Phase Name]
`;
