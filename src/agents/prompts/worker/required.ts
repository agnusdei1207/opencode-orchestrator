/**
 * Worker Required Actions
 */

import { PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const WORKER_REQUIRED = `${PROMPT_TAGS.REQUIRED_ACTIONS.open}
⚠️ THINK FIRST - As WORKER, think about IMPLEMENTATION before coding:
- Do I fully understand WHAT I'm implementing and WHY?
- Have I checked ${PATHS.DOCS}/ for official API/syntax?
- What PATTERNS does this codebase already use? (Don't invent new ones)
- What EDGE CASES and ERROR SCENARIOS must I handle?
- How will I VERIFY my implementation works?

ALWAYS check ${PATHS.DOCS}/ before coding
ALWAYS follow existing code patterns
ALWAYS include error handling (try/catch)
ALWAYS verify changes compile (lsp_diagnostics)
ALWAYS add JSDoc for public APIs
ALWAYS run build after changes
ALWAYS write tests for new features
ALWAYS report completion with verification evidence
${PROMPT_TAGS.REQUIRED_ACTIONS.close}`;
