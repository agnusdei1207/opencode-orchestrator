/**
 * Shared Workspace Configuration
 * 
 * Defines the .opencode/ directory structure.
 */

import { ID_PREFIX, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const SHARED_WORKSPACE = `${PROMPT_TAGS.SHARED_WORKSPACE.open}
 .opencode/ - Shared Context Directory (Real-time State)

\`\`\`
.opencode/
├── todo.md              - Master task list (single source of truth)
├── context.md           - Project context summary (<150 lines)
├── work-log.md          - 🔄 REAL-TIME work status (ALL agents read/write)
│                        # - Active sessions & assigned files
│                        # - Unit test completion records
│                        # - Pending integration items
├── unit-tests/          - 📝 Unit test records (preserved after deletion)
│   └── [timestamp]-[file].md  # Test content, results, deleted test code
├── sync-issues.md       - ⚠️ File sync issues (Reviewer writes)
├── integration-status.md - ✅ Integration test results & sync status
├── docs/                - Cached documentation
└── archive/             - Old context
\`\`\`

## ID Formats (no digit limit):
- Session: ${ID_PREFIX.SESSION}N (e.g., ${ID_PREFIX.SESSION}1, ${ID_PREFIX.SESSION}42)
- Sync Issue: ${ID_PREFIX.SYNC_ISSUE}N (e.g., ${ID_PREFIX.SYNC_ISSUE}1, ${ID_PREFIX.SYNC_ISSUE}100)
- Unit Test: ${ID_PREFIX.UNIT_TEST}N (e.g., ${ID_PREFIX.UNIT_TEST}1, ${ID_PREFIX.UNIT_TEST}50)

## Status Values:
- Action: ${WORK_STATUS.ACTION.CREATE} | ${WORK_STATUS.ACTION.MODIFY} | ${WORK_STATUS.ACTION.DELETE} | ${WORK_STATUS.ACTION.FIX}
- Status: ${WORK_STATUS.STATUS.PENDING} | ${WORK_STATUS.STATUS.IN_PROGRESS} | ${WORK_STATUS.STATUS.DONE}
- Test: ${WORK_STATUS.TEST_RESULT.PASS} | ${WORK_STATUS.TEST_RESULT.FAIL}

## work-log.md FORMAT:
\`\`\`markdown
# Work Log

## Active Sessions
- [ ] ${ID_PREFIX.SESSION}1 (Worker): \`src/auth/login.ts\` - ${WORK_STATUS.STATUS.IN_PROGRESS}
- [x] ${ID_PREFIX.SESSION}2 (Worker): \`src/utils/hash.ts\` - ${WORK_STATUS.SESSION.COMPLETED}

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
- ALL agents MUST read work-log.md before starting
- Worker updates work-log.md when starting/completing file work
- Reviewer monitors work-log.md for completed units
- Commander reads work-log.md in each loop iteration
- sync-issues.md = Reviewer writes issues for next iteration
${PROMPT_TAGS.SHARED_WORKSPACE.close}`;
