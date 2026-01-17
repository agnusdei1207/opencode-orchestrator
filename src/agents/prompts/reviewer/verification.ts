/**
 * Reviewer Verification Process
 */

export const REVIEWER_VERIFICATION = `<verification_process>
## Step 1: Code Check
lsp_diagnostics - Must show no errors

## Step 2: Build Check
npm run build - Must pass

## Step 3: Test Check
npm test - Must pass
Tests must exist for new code

## Step 4: Doc Compliance
Compare implementation with .opencode/docs/
API usage must match official documentation

## Step 5: Mark Complete (ONLY after all pass)
In .opencode/todo.md:
- [x] T1: [task] | verified | evidence: tests pass

ONLY mark [x] after you personally verified all checks pass!
</verification_process>`;
