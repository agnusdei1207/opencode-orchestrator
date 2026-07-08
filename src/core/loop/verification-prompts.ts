import { CHECKLIST, PATHS, type VerificationResult } from "../../shared/index.js";

const CHECKLIST_FILE = CHECKLIST.FILE;
const VERIFICATION_MARK = {
    passed: "✅",
    failed: "❌",
    warning: "⚠️",
} as const;

function statusMark(passed: boolean): string {
    return passed ? VERIFICATION_MARK.passed : VERIFICATION_MARK.failed;
}

export function buildVerificationFailurePrompt(result: VerificationResult): string {
    const errorList = result.errors.map(e => `${VERIFICATION_MARK.failed} ${e}`).join('\n');
    const hasChecklist = result.checklistProgress !== "0/0";

    return `<verification_failure>
${VERIFICATION_MARK.warning} **COMPLETION BLOCKED - Verification Failed**

Your attempt to finish was detected but the following checks **FAILED**:

${errorList}

## Current Status
| Check | Status | Details |
|-------|--------|---------|
${hasChecklist ? `| Checklist | ${statusMark(result.checklistComplete)} | ${result.checklistProgress} verified |` : ''}
| TODO Progress | ${statusMark(result.todoComplete)} | ${result.todoProgress} complete |
| Sync Issues | ${statusMark(result.syncIssuesEmpty)} | ${result.syncIssuesCount} issue(s) |

## REQUIRED ACTIONS (DO NOT TRY TO FINISH AGAIN UNTIL RESOLVED)

${hasChecklist ? `1. **Complete Checklist**: \`cat ${CHECKLIST_FILE}\` - Check off ALL [ ] items
2. **Verify each item passes** before marking [x]` : `1. **Check TODO**: \`cat ${PATHS.TODO}\` - Find ALL [ ] items
2. **Complete remaining tasks** - Execute each incomplete item`}
3. **Check sync issues**: \`cat ${PATHS.SYNC_ISSUES}\` - Resolve any errors
4. **Verify builds/tests pass** - Run project build and test commands
5. **Only conclude when ALL conditions pass**

${VERIFICATION_MARK.warning} The system will BLOCK premature completion every time. Work until truly complete.

**CONTINUE EXECUTING NOW** - Do not wait for user input.
</verification_failure>`;
}

export function buildTodoIncompletePrompt(result: VerificationResult): string {
    return `${VERIFICATION_MARK.warning} **TODO Incomplete: ${result.todoProgress}**

${result.todoIncomplete} task(s) remaining. Continue working on incomplete items.

**REQUIRED**: Check .opencode/todo.md and complete ALL [ ] items before concluding.

\`\`\`bash
cat .opencode/todo.md
\`\`\`

**DO NOT** try to finish until ALL items are [x].`;
}

export function buildVerificationSummary(result: VerificationResult): string {
    const status = result.passed
        ? `${VERIFICATION_MARK.passed} PASSED`
        : `${VERIFICATION_MARK.failed} FAILED`;
    const hasChecklist = result.checklistProgress !== "0/0";

    if (hasChecklist) {
        return `[Verification ${status}] Checklist: ${result.checklistProgress}, TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
    }
    return `[Verification ${status}] TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
}
