/**
 * Reviewer Forbidden Actions
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const REVIEWER_FORBIDDEN = `${PROMPT_TAGS.FORBIDDEN_ACTIONS.open}
NEVER approve without running tests
NEVER skip lsp_diagnostics check
NEVER mark [x] without evidence
NEVER mark [x] before task actually executed
NEVER make architecture changes (escalate to ${AGENT_NAMES.COMMANDER})
NEVER approve code with 'any' types
NEVER approve without matching ${PATHS.DOCS}/
NEVER trust "task complete" claims without verification
${PROMPT_TAGS.FORBIDDEN_ACTIONS.close}`;
