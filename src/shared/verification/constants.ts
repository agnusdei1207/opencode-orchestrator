/**
 * Verification constants (consolidated)
 */
import type { ChecklistCategory } from "./types.js";
import { PATHS } from "../core/constants.js";

/**
 * Verification Signaling Constants
 * 
 * Centralized strings used to trigger specific verification behaviors
 * between the Commander and Reviewer agents.
 */
export const VERIFICATION_SIGNALS = {
    /** Trigger for all-encompassing system check at the end of a mission */
    FINAL_PASS: "Full System Verification",
} as const;

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
export const CATEGORY_ID = {
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
export const CATEGORY_LABEL = {
    [CATEGORY_ID.CODE_QUALITY]: "Code Quality",
    [CATEGORY_ID.UNIT_TESTS]: "Unit Tests",
    [CATEGORY_ID.INTEGRATION_TESTS]: "Integration Tests",
    [CATEGORY_ID.BUILD]: "Build Verification",
    [CATEGORY_ID.RUNTIME]: "Runtime Verification",
    [CATEGORY_ID.INFRASTRUCTURE]: "Infrastructure & Environment",
    [CATEGORY_ID.CUSTOM]: "Project-Specific Checks",
} as const satisfies Record<ChecklistCategory, string>;

/**
 * Category Descriptions - Detailed descriptions for each category
 */
export const CATEGORY_DESCRIPTION = {
    [CATEGORY_ID.CODE_QUALITY]: "Lint, type check, static analysis",
    [CATEGORY_ID.UNIT_TESTS]: "Unit tests execution",
    [CATEGORY_ID.INTEGRATION_TESTS]: "E2E and integration tests",
    [CATEGORY_ID.BUILD]: "Build verification",
    [CATEGORY_ID.RUNTIME]: "Runtime verification (starts, runs)",
    [CATEGORY_ID.INFRASTRUCTURE]: "Docker, compose, CI/CD, etc.",
    [CATEGORY_ID.CUSTOM]: "Project-specific custom checks",
} as const satisfies Record<ChecklistCategory, string>;

/**
 * Category Icons - Visual indicators for each category
 */
export const CATEGORY_ICON = {
    [CATEGORY_ID.CODE_QUALITY]: "🔍",
    [CATEGORY_ID.UNIT_TESTS]: "🧪",
    [CATEGORY_ID.INTEGRATION_TESTS]: "🔗",
    [CATEGORY_ID.BUILD]: "🔨",
    [CATEGORY_ID.RUNTIME]: "▶️",
    [CATEGORY_ID.INFRASTRUCTURE]: "🏗️",
    [CATEGORY_ID.CUSTOM]: "⚙️",
} as const satisfies Record<ChecklistCategory, string>;

/**
 * Combined category information object
 */
export const CHECKLIST_CATEGORIES = {
    IDS: CATEGORY_ID,
    LABELS: CATEGORY_LABEL,
    DESCRIPTIONS: CATEGORY_DESCRIPTION,
    ICONS: CATEGORY_ICON,
} as const;

