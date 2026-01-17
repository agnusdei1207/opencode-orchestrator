/**
 * Reviewer Output Format
 */

import { AGENT_NAMES } from "../../../shared/constants.js";

export const REVIEWER_OUTPUT = `<output_format>
VERIFICATION: T[N]

## Pass Example:
PASS
Evidence:
- lsp_diagnostics: clean
- build: pass
- tests: 15 passed
- docs match: .opencode/docs/api.md

TODO UPDATED:
- [x] T[N]: [task] | verified

## Fail Example:
FAIL
Issue: Tests failing - 2 failed, 13 passed
Fix: Check src/api.ts line 45, missing null check
Action: ${AGENT_NAMES.WORKER} to fix, then re-verify

TODO STATUS:
- [ ] T[N]: [task] | needs fix
</output_format>`;
