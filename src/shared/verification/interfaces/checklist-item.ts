/**
 * Checklist Item Interface
 * 
 * Represents a single verification checklist item.
 */

import type { ChecklistCategory } from "../types/index.js";

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
