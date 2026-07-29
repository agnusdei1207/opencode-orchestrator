/**
 * Verification types and interfaces (consolidated)
 */

/**
 * Checklist Category Type
 * 
 * Type definition for verification checklist categories.
 * Derived from CATEGORY_ID constant for single source of truth.
 */

/**
 * Available checklist category identifiers
 * 
 * - code-quality: Lint, type check, static analysis
 * - unit-tests: Unit tests execution
 * - integration-tests: E2E and integration tests
 * - build: Build verification
 * - runtime: Runtime verification (starts, runs)
 * - infrastructure: Docker, compose, CI/CD, etc.
 * - custom: Project-specific custom checks
 */
export type ChecklistCategory =
    | "code-quality"
    | "unit-tests"
    | "integration-tests"
    | "build"
    | "runtime"
    | "infrastructure"
    | "custom";

/**
 * Checklist Item Interface
 * 
 * Represents a single verification checklist item.
 */


/**
 * A single item in the verification checklist
 */
export interface ChecklistItem {
    /** Unique ID for the item (e.g., "unit-tests", "build", "docker") */
    id: string;

    /** Category of the check */
    category: ChecklistCategory;

    /** Description of what to verify */
    description: string;

    /** Whether this item is completed */
    completed: boolean;

    /** Optional: Evidence or notes about verification */
    evidence?: string;
}

/**
 * Verification Checklist Interface
 * 
 * Represents the complete verification checklist with metadata.
 */


/**
 * Complete verification checklist with metadata
 */
export interface VerificationChecklist {
    /** Unique mission ID or timestamp */
    missionId: string;

    /** When the checklist was created */
    createdAt: string;

    /** Last update time */
    updatedAt: string;

    /** All checklist items */
    items: ChecklistItem[];
}

/**
 * Checklist Verification Result Interface
 * 
 * Result of verifying a checklist's completion status.
 */

/**
 * Result of verifying a checklist
 */
export interface ChecklistVerificationResult {
    /** Whether the checklist file exists */
    present: boolean;

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

    /** Whether a TODO file exists on disk, regardless of whether it could be read */
    todoPresent: boolean;

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

    /** Whether a verification checklist file exists */
    checklistPresent: boolean;

    /** Checklist progress string */
    checklistProgress: string;

    /** List of verification failures */
    errors: string[];
}
