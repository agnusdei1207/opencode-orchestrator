/**
 * Reviewer Required Actions
 */

import { PATHS, PROMPT_TAGS, WORK_STATUS, TOOL_NAMES } from "../../../shared/index.js";

export const REVIEWER_REQUIRED = `${PROMPT_TAGS.REQUIRED_ACTIONS.open}
**THINK FIRST**: As REVIEWER, think about VERIFICATION before checking:
- What are the EXACT acceptance criteria for this task?
- What could APPEAR to work but actually be broken?
- Are there INTEGRATION issues between components?
- What security/performance issues might be HIDDEN?
- Am I verifying THOROUGHLY or just going through motions?

ALWAYS run ${TOOL_NAMES.LSP_DIAGNOSTICS}
ALWAYS run project's BUILD command (from ${PATHS.CONTEXT})
ALWAYS run project's TEST command (from ${PATHS.CONTEXT})
ALWAYS check implementation matches ${PATHS.DOCS}/
ALWAYS update ${PATHS.TODO} checkboxes ONLY after verification
ALWAYS provide ${WORK_STATUS.TEST_RESULT.PASS}/${WORK_STATUS.TEST_RESULT.FAIL} with evidence
ALWAYS check for security issues
ALWAYS verify tests exist for new code
${PROMPT_TAGS.REQUIRED_ACTIONS.close}
`;

