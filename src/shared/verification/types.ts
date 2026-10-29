export type ChecklistCategory =
    | "code-quality"
    | "unit-tests"
    | "integration-tests"
    | "build"
    | "runtime"
    | "infrastructure"
    | "custom";

export interface ChecklistItem {
    category: ChecklistCategory;
    description: string;
    completed: boolean;
}

export interface ChecklistVerificationResult {
    /** Whether the checklist file exists. */
    present: boolean;
    passed: boolean;
    totalItems: number;
    completedItems: number;
    incompleteItems: number;
    /** "completed/total", e.g. "8/10". */
    progress: string;
    /** Incomplete items as "[Category label] description". */
    incompleteList: string[];
    errors: string[];
}

/** Mission completion result combining the TODO, sync issues and the optional checklist. */
export interface VerificationResult {
    passed: boolean;
    todoComplete: boolean;
    /** Whether a TODO file exists on disk, regardless of whether it could be read. */
    todoPresent: boolean;
    /** "completed/total", e.g. "8/10". */
    todoProgress: string;
    todoIncomplete: number;
    /** Whether sync-issues.md is absent or lists no open issue. */
    syncIssuesEmpty: boolean;
    syncIssuesCount: number;
    checklistComplete: boolean;
    checklistPresent: boolean;
    checklistProgress: string;
    errors: string[];
}
