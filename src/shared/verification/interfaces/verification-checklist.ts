/**
 * Verification Checklist Interface
 * 
 * Represents the complete verification checklist with metadata.
 */

import type { ChecklistItem } from "./checklist-item.js";

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
