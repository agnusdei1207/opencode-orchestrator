/**
 * Verification constants (consolidated)
 */
import type { ChecklistCategory } from "./types.js";
import { PATHS } from "../core/constants.js";

/**
 * Checklist Parsing Patterns
 * 
 * Regular expressions for parsing verification checklist markdown.
 */

export const CHECKLIST_PATTERNS = {
    /** Item with ID format: - [ ] **ID**: Description */
    ITEM_WITH_ID: /^[-*]\s*\[([xX\s])\]\s+\*\*([^*]+)\*\*:\s+(.+)$/,

    /** Simple item format: - [ ] Description */
    SIMPLE_ITEM: /^[-*]\s*\[([xX\s])\]\s+(.+)$/,
} as const;

/**
 * Verification Checklist Constants
 * 
 * File paths and configuration for the verification checklist system.
 */


/**
 * Checklist file and configuration constants
 */
export const CHECKLIST = {
    /** Path to the verification checklist file */
    FILE: `${PATHS.OPENCODE}/verification-checklist.md`,

    /** Minimum required items for valid checklist */
    MIN_ITEMS: 1,

    /** Maximum items to show in error messages */
    MAX_ERROR_ITEMS: 5,
} as const;

/**
 * Checklist Category Constants
 * 
 * Category definitions for verification checklist items.
 * Categories are used to group and organize verification steps.
 */


/**
 * Category IDs - Used as keys for category identification
 */
const CATEGORY_ID = {
    CODE_QUALITY: "code-quality",
    UNIT_TESTS: "unit-tests",
    INTEGRATION_TESTS: "integration-tests",
    BUILD: "build",
    RUNTIME: "runtime",
    INFRASTRUCTURE: "infrastructure",
    CUSTOM: "custom",
} as const;

/**
 * Category Display Labels - Human-readable names for each category
 */
const CATEGORY_LABEL = {
    [CATEGORY_ID.CODE_QUALITY]: "Code Quality",
    [CATEGORY_ID.UNIT_TESTS]: "Unit Tests",
    [CATEGORY_ID.INTEGRATION_TESTS]: "Integration Tests",
    [CATEGORY_ID.BUILD]: "Build Verification",
    [CATEGORY_ID.RUNTIME]: "Runtime Verification",
    [CATEGORY_ID.INFRASTRUCTURE]: "Infrastructure & Environment",
    [CATEGORY_ID.CUSTOM]: "Project-Specific Checks",
} as const satisfies Record<ChecklistCategory, string>;

/**
 * Combined category information object
 */
export const CHECKLIST_CATEGORIES = {
    IDS: CATEGORY_ID,
    LABELS: CATEGORY_LABEL,
} as const;
