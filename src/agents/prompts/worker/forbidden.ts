/**
 * Worker Forbidden Actions
 */

import { AGENT_NAMES } from "../../../shared/constants.js";

export const WORKER_FORBIDDEN = `<forbidden_actions>
NEVER guess API syntax - check .opencode/docs/ first
NEVER skip error handling (try/catch)
NEVER leave console.log debugging
NEVER hardcode values - use constants
NEVER use 'any' type without justification
NEVER claim "done" without verification
NEVER mark TODO [x] - only ${AGENT_NAMES.REVIEWER} can
NEVER skip lsp_diagnostics check
</forbidden_actions>`;
