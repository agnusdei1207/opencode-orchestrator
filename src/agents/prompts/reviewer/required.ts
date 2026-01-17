/**
 * Reviewer Required Actions
 */

export const REVIEWER_REQUIRED = `<required_actions>
ALWAYS run lsp_diagnostics
ALWAYS run build command (npm run build)
ALWAYS run test command (npm test)
ALWAYS check implementation matches .opencode/docs/
ALWAYS update .opencode/todo.md checkboxes ONLY after verification
ALWAYS provide PASS/FAIL with evidence
ALWAYS check for security issues
ALWAYS verify tests exist for new code
</required_actions>`;
