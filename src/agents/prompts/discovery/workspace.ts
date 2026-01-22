/**
 * Shared Workspace Configuration
 * 
 * Defines the .opencode/ directory structure.
 */

import { ID_PREFIX, PATHS, PROMPT_TAGS, WORK_STATUS, AGENT_NAMES, STATUS_LABEL } from "../../../shared/index.js";

export const SHARED_WORKSPACE = `${PROMPT_TAGS.SHARED_WORKSPACE.open}
${PATHS.OPENCODE}/ - Shared Context Directory (Real-time State)

\`\`\`
${PATHS.OPENCODE}/
├── ${PATHS.TODO.split("/").pop()}              - Master task list (single source of truth)
├── ${PATHS.CONTEXT.split("/").pop()}           - Project context summary (<150 lines)
├── ${PATHS.WORK_LOG.split("/").pop()}          - REAL-TIME work status (ALL agents read/write)
│                        # - Active sessions & assigned files
│                        # - Unit test completion records
│                        # - Pending integration items
├── ${PATHS.UNIT_TESTS.split("/").pop()}/          - Unit test records (preserved after deletion)
│   └── [timestamp]-[file].md  # Test content, results, deleted test code
├── ${PATHS.SYNC_ISSUES.split("/").pop()}       - File sync issues (Reviewer writes)
├── ${PATHS.INTEGRATION_STATUS.split("/").pop()} - Integration test results & sync status
├── ${PATHS.DOCS.split("/").pop()}/                - Cached documentation
└── ${PATHS.ARCHIVE.split("/").pop()}/             - Old context
\`\`\`



## ID Formats (no digit limit):
- Session: ${ID_PREFIX.SESSION}N (e.g., ${ID_PREFIX.SESSION}1, ${ID_PREFIX.SESSION}42)
- Sync Issue: ${ID_PREFIX.SYNC_ISSUE}N (e.g., ${ID_PREFIX.SYNC_ISSUE}1, ${ID_PREFIX.SYNC_ISSUE}100)
- Unit Test: ${ID_PREFIX.UNIT_TEST}N (e.g., ${ID_PREFIX.UNIT_TEST}1, ${ID_PREFIX.UNIT_TEST}50)

## Status Values:
- Action: ${WORK_STATUS.ACTION.CREATE} | ${WORK_STATUS.ACTION.MODIFY} | ${WORK_STATUS.ACTION.DELETE} | ${WORK_STATUS.ACTION.FIX}
- Status: ${WORK_STATUS.STATUS.PENDING} | ${WORK_STATUS.STATUS.IN_PROGRESS} | ${WORK_STATUS.STATUS.DONE}
- Test: ${WORK_STATUS.TEST_RESULT.PASS} | ${WORK_STATUS.TEST_RESULT.FAIL}

## ${PATHS.WORK_LOG} FORMAT:
\`\`\`markdown
# Work Log

## Active Sessions
- [ ] ${ID_PREFIX.SESSION}1 (${AGENT_NAMES.WORKER}): \`src/auth/login.ts\` - ${WORK_STATUS.STATUS.IN_PROGRESS}
- [x] ${ID_PREFIX.SESSION}2 (${AGENT_NAMES.WORKER}): \`src/utils/hash.ts\` - ${WORK_STATUS.SESSION.COMPLETED}

## Completed Units (Ready for Integration)
| File | Session | Unit Test | Timestamp |
|------|---------|-----------|-----------|
| src/utils/hash.ts | ${ID_PREFIX.SESSION}2 | ${WORK_STATUS.TEST_RESULT.PASS} | 2026-01-18T09:00:00 |

## Pending Integration
- src/utils/hash.ts
\`\`\`

## PATH NOTES:
- File paths use forward slash '/' in examples
- On Windows, paths may use backslash '\\\\'
- Use path.normalize() or similar when comparing paths programmatically

RULES:
- ALL agents MUST read ${PATHS.WORK_LOG} before starting
- ${AGENT_NAMES.WORKER} updates ${PATHS.WORK_LOG} when starting/completing file work
- ${AGENT_NAMES.REVIEWER} monitors ${PATHS.WORK_LOG} for completed units
- ${AGENT_NAMES.COMMANDER} reads ${PATHS.WORK_LOG} in each loop iteration
- ${PATHS.SYNC_ISSUES} = ${AGENT_NAMES.REVIEWER} writes issues for next iteration
${PROMPT_TAGS.SHARED_WORKSPACE.close}
`;
