/**
 * Checklist Verification Result Interface
 * 
 * Result of verifying a checklist's completion status.
 */

/**
 * Result of verifying a checklist
 */
export interface ChecklistVerificationResult {
    /** Whether all items are complete */
    passed: boolean;

    /** Total number of items */
    totalItems: number;

    /** Number of completed items */
    completedItems: number;

    /** Number of incomplete items */
    incompleteItems: number;

    /** Progress string e.g., "8/10" */
    progress: string;

    /** List of incomplete item descriptions */
    incompleteList: string[];

    /** List of verification failures */
    errors: string[];
}
