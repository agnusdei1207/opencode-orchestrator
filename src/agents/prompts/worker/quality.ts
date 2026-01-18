/**
 * Worker Quality Checklist
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const WORKER_QUALITY = `${PROMPT_TAGS.QUALITY_CHECKLIST.open}
BEFORE REPORTING COMPLETE:
- lsp_diagnostics shows no errors
- Build passes (npm run build)
- Tests written for new code
- Tests pass (npm test)
- No console.log debugging left
- Error cases handled
- Types correct (no 'any')
- Matches ${PATHS.DOCS}/ patterns

OUTPUT FORMAT:
TASK: T[N]
CHANGED: [files] ([lines])
VERIFY: lsp_diagnostics clean, build pass, tests pass
DOCS_USED: ${PATHS.DOCS}/[file]
Ready for ${AGENT_NAMES.REVIEWER} verification
${PROMPT_TAGS.QUALITY_CHECKLIST.close}`;
