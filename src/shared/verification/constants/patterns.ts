/**
 * Checklist Parsing Patterns
 * 
 * Regular expressions for parsing verification checklist markdown.
 */

export const CHECKLIST_PATTERNS = {
    /** Incomplete item: - [ ] */
    INCOMPLETE: /^[-*]\s*\[\s*\]\s+(.+)$/gm,

    /** Complete item: - [x] or - [X] */
    COMPLETE: /^[-*]\s*\[[xX]\]\s+(.+)$/gm,

    /** Category header: ## Category */
    CATEGORY: /^##\s+(.+)$/gm,

    /** Item with ID format: - [ ] **ID**: Description */
    ITEM_WITH_ID: /^[-*]\s*\[([xX\s])\]\s+\*\*([^*]+)\*\*:\s+(.+)$/,

    /** Simple item format: - [ ] Description */
    SIMPLE_ITEM: /^[-*]\s*\[([xX\s])\]\s+(.+)$/,

    /** Mark as complete indicator (x or X) */
    COMPLETE_MARK: /^x$/i,
} as const;
