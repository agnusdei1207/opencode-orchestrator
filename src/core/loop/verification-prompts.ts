import type { VerificationResult } from "../../shared/index.js";

const VERIFICATION_MARK = { passed: "✅", failed: "❌" } as const;

export function buildVerificationSummary(result: VerificationResult): string {
    const status = result.passed
        ? `${VERIFICATION_MARK.passed} PASSED`
        : `${VERIFICATION_MARK.failed} FAILED`;
    const hasChecklist = result.checklistPresent;

    if (hasChecklist) {
        return `[Verification ${status}] Checklist: ${result.checklistProgress}, TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
    }
    return `[Verification ${status}] TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
}
