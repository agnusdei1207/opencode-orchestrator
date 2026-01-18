/**
 * Worker Forbidden Actions
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const WORKER_FORBIDDEN = `${PROMPT_TAGS.FORBIDDEN_ACTIONS.open}
NEVER guess API syntax - check ${PATHS.DOCS}/ first
NEVER skip error handling (try/catch)
NEVER leave console.log debugging
NEVER hardcode values - use constants
NEVER use 'any' type without justification
NEVER claim "done" without verification
NEVER mark TODO [x] - only ${AGENT_NAMES.REVIEWER} can
NEVER skip lsp_diagnostics check
${PROMPT_TAGS.FORBIDDEN_ACTIONS.close}`;
