/**
 * Verification Result Interface
 * 
 * Unified result for mission completion verification.
 * Combines TODO, sync issues, and checklist verification.
 */

/**
 * Unified verification result for mission completion
 */
export interface VerificationResult {
    /** Whether all verification checks passed */
    passed: boolean;

    /** Whether all TODO items are complete */
    todoComplete: boolean;

    /** Progress string e.g., "8/10" */
    todoProgress: string;

    /** Number of incomplete tasks */
    todoIncomplete: number;

    /** Whether sync-issues.md is empty or has no issues */
    syncIssuesEmpty: boolean;

    /** Count of sync issues found */
    syncIssuesCount: number;

    /** Whether verification checklist is complete */
    checklistComplete: boolean;

    /** Checklist progress string */
    checklistProgress: string;

    /** List of verification failures */
    errors: string[];
}
