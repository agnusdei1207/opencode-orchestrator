/**
 * Worker TDD Workflow
 * 
 * Test-Driven Development workflow for file-level isolated work.
 * Language-agnostic - works with any programming language.
 */

import { PATHS, PROMPT_TAGS, ID_PREFIX, WORK_STATUS } from "../../../shared/index.js";

export const WORKER_TDD_WORKFLOW = `${PROMPT_TAGS.TDD_WORKFLOW.open}
## TDD (Test-Driven Development) MANDATORY WORKFLOW

You work on ONE FILE at a time in ISOLATION. Follow this EXACT cycle:

### Phase 1: SETUP
1. Read ${PATHS.WORK_LOG} - Check assigned file
2. Read ${PATHS.TODO} - Understand requirements
3. Update ${PATHS.WORK_LOG}:
   \`\`\`markdown
   - [ ] ${ID_PREFIX.SESSION}N (Worker): \`[target-file]\` - ${WORK_STATUS.SESSION.STARTED}
   \`\`\`

### Phase 2: TEST FIRST (Red)
1. Create ISOLATED test file for target file
   - Naming: \`[filename].isolated.test.[ext]\` (language-appropriate)
2. Write tests that ONLY test the target file
3. Mock/Dummy ALL external dependencies:
   - Database → Return fake data
   - External API → Mock response
   - Filesystem → Memory or temp
   - Other modules → Mock exports
4. Run test - MUST FAIL (Red phase)

### Phase 3: IMPLEMENT (Green)
1. Write minimal code to pass tests
2. Run test - MUST PASS (Green phase)
3. Iterate until all tests pass

### Phase 4: CLEANUP & RECORD
1. Record test in ${PATHS.UNIT_TESTS}/:
   \`\`\`markdown
   # Unit Test Record: [filename]
   
   ## Target File
   \`[full-path]\`
   
   ## Test File (DELETED)
   \`[test-file-path]\`
   
   ## Test Code (Preserved)
   \\\`\\\`\\\`[language]
   [full test code here]
   \\\`\\\`\\\`
   
   ## Test Result
   - Status: ${WORK_STATUS.TEST_RESULT.PASS}
   - Session: ${ID_PREFIX.SESSION}N
   - Timestamp: [ISO timestamp]
   \`\`\`

2. DELETE the isolated test file (code preserved above)
3. Update ${PATHS.WORK_LOG} with ${WORK_STATUS.STATUS.DONE} + ${WORK_STATUS.TEST_RESULT.PASS}

---

## Isolation Requirements (Language-Agnostic)
1. **Import ONLY target file** - Only the file being worked on
2. **Mock ALL external dependencies**:
   - Communication/interaction needed → Assume dummy response
   - Real I/O strictly forbidden
3. **Delete after pass** - Remove isolated test file
4. **Record in .opencode** - Preserve test code and results

### CRITICAL RULES:
- NEVER skip the test file deletion step
- ALWAYS preserve test code in ${PATHS.UNIT_TESTS}/
- NEVER mark [x] in todo.md - Reviewer's job!
- ONE file per session - complete isolation
${PROMPT_TAGS.TDD_WORKFLOW.close}`;
