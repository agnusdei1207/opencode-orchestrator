/**
 * Planner File-Level Planning
 * 
 * Plans work at FILE LEVEL - listing all files to create/modify/delete.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_FILE_PLANNING = `${PROMPT_TAGS.FILE_LEVEL_PLANNING.open}
## FILE-LEVEL PLANNING (MANDATORY)

Before any work begins, you MUST identify ALL files:

### Step 1: Analyze Requirements
- What needs to be built/changed?
- What existing files are affected?

### Step 2: Create File Manifest
Write to ${PATHS.TODO}:

\`\`\`markdown
# Mission: [goal]

## File Manifest
| Action | File Path | Description | Dependencies |
|--------|-----------|-------------|--------------|
| ${WORK_STATUS.ACTION.CREATE} | src/auth/login.ts | Login function | - |
| ${WORK_STATUS.ACTION.CREATE} | src/auth/logout.ts | Logout function | login.ts |
| ${WORK_STATUS.ACTION.MODIFY} | src/index.ts | Export auth module | login.ts, logout.ts |
| ${WORK_STATUS.ACTION.CREATE} | src/types/auth.ts | Auth types | - |
| ${WORK_STATUS.ACTION.DELETE} | src/old-auth.ts | Remove deprecated | - |

## Work Assignments (File-Level, canonical M/T/S schema)
Each ${AGENT_NAMES.WORKER} gets ONE file:

## M1: Auth Feature
### T1.1: Auth Module | parallel-group:1
- [ ] S1.1.1: ${WORK_STATUS.ACTION.CREATE} \`src/types/auth.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/types/auth.ts
- [ ] S1.1.2: ${WORK_STATUS.ACTION.CREATE} \`src/auth/login.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/auth/login.ts
- [ ] S1.1.3: ${WORK_STATUS.ACTION.CREATE} \`src/auth/logout.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/auth/logout.ts

### T1.2: Integration | parallel-group:2 | depends:T1.1
- [ ] S1.2.1: ${WORK_STATUS.ACTION.MODIFY} \`src/index.ts\` | agent:${AGENT_NAMES.WORKER} | file:src/index.ts
\`\`\`

### Step 3: Initialize Work Log
Create ${PATHS.WORK_LOG} using the canonical schema from <shared_workspace>:

\`\`\`markdown
# Work Log

## Active Sessions
(none yet)

## File Status
| File | Action | Status | Session | Unit Test | Timestamp | Issue |
|------|--------|--------|---------|-----------|-----------|-------|
| src/types/auth.ts | ${WORK_STATUS.ACTION.CREATE} | ${WORK_STATUS.STATUS.PENDING} | - | - | - | - |
| src/auth/login.ts | ${WORK_STATUS.ACTION.CREATE} | ${WORK_STATUS.STATUS.PENDING} | - | - | - | - |
| src/auth/logout.ts | ${WORK_STATUS.ACTION.CREATE} | ${WORK_STATUS.STATUS.PENDING} | - | - | - | - |
| src/index.ts | ${WORK_STATUS.ACTION.MODIFY} | ${WORK_STATUS.STATUS.PENDING} | - | - | - | - |

## Pending Integration
(none yet)
\`\`\`

### PATH NOTES:
- File paths use forward slash '/' in examples
- On Windows, paths may use backslash '\\\\'

### CRITICAL RULES:
- Every subtask = exactly ONE file
- Include \`file:[path]\` tag for each subtask
- Action must be ${WORK_STATUS.ACTION.CREATE}, ${WORK_STATUS.ACTION.MODIFY}, ${WORK_STATUS.ACTION.DELETE}, or ${WORK_STATUS.ACTION.FIX}
- List dependencies between files
${PROMPT_TAGS.FILE_LEVEL_PLANNING.close}`;

