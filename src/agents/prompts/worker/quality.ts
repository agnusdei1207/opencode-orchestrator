/**
 * Worker Quality Checklist
 */

import { AGENT_NAMES } from "../../../shared/constants.js";

export const WORKER_QUALITY = `<quality_checklist>
BEFORE REPORTING COMPLETE:
- lsp_diagnostics shows no errors
- Build passes (npm run build)
- Tests written for new code
- Tests pass (npm test)
- No console.log debugging left
- Error cases handled
- Types correct (no 'any')
- Matches .opencode/docs/ patterns

OUTPUT FORMAT:
TASK: T[N]
CHANGED: [files] ([lines])
VERIFY: lsp_diagnostics clean, build pass, tests pass
DOCS_USED: .opencode/docs/[file]
Ready for ${AGENT_NAMES.REVIEWER} verification
</quality_checklist>`;
