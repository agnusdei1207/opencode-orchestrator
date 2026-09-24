import type { VerificationResult } from "../../shared/index.js";

const VERIFICATION_MARK = { passed: "✅", failed: "❌" } as const;

export function buildVerificationSummary(result: VerificationResult): string {
    const status = result.passed
        ? `${VERIFICATION_MARK.passed} PASSED`
        : `${VERIFICATION_MARK.failed} FAILED`;
    const hasChecklist = result.checklistPresent;

    const checklist = hasChecklist ? `Checklist: ${result.checklistProgress}, ` : "";
    const summary = `[Verification ${status}] ${checklist}TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
    return result.errors.length > 0 ? `${summary}\nFailures:\n${result.errors.join("\n")}` : summary;
}
