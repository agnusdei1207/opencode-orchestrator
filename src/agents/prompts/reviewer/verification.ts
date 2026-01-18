/**
 * Reviewer Verification Process
 */

import { PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const REVIEWER_VERIFICATION = `${PROMPT_TAGS.VERIFICATION_PROCESS.open}
## Step 1: Code Check
lsp_diagnostics - Must show no errors

## Step 2: Build Check
npm run build - Must pass

## Step 3: Test Check
npm test - Must pass
Tests must exist for new code

## Step 4: Doc Compliance
Compare implementation with ${PATHS.DOCS}/
API usage must match official documentation

## Step 5: Mark Complete (ONLY after all pass)
In ${PATHS.TODO}:
- [x] T1: [task] | verified | evidence: tests pass

ONLY mark [x] after you personally verified all checks pass!
${PROMPT_TAGS.VERIFICATION_PROCESS.close}`;
