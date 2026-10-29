import type { ChecklistCategory } from "./types.js";
import { PATHS } from "../core/constants.js";

/**
 * Checklist item lines. `[x]` is done; `[ ]`, `[/]` (in progress) and `[-]`
 * (failed) are not, matching the TODO markers update_todo writes.
 */
export const CHECKLIST_PATTERNS = {
    /** `- [ ] **ID**: Description` */
    ITEM_WITH_ID: /^[-*]\s*\[([xX\s/-])\]\s+\*\*([^*]+)\*\*:\s+(.+)$/,
    /** `- [ ] Description` */
    SIMPLE_ITEM: /^[-*]\s*\[([xX\s/-])\]\s+(.+)$/,
} as const;

export const CHECKLIST = {
    FILE: `${PATHS.OPENCODE}/verification-checklist.md`,
    MIN_ITEMS: 1,
    /** Incomplete items listed in a verification error before "... and N more". */
    MAX_ERROR_ITEMS: 5,
} as const;

const CATEGORY_ID = {
    CODE_QUALITY: "code-quality",
    UNIT_TESTS: "unit-tests",
    INTEGRATION_TESTS: "integration-tests",
    BUILD: "build",
    RUNTIME: "runtime",
    INFRASTRUCTURE: "infrastructure",
    CUSTOM: "custom",
} as const;

const CATEGORY_LABEL = {
    [CATEGORY_ID.CODE_QUALITY]: "Code Quality",
    [CATEGORY_ID.UNIT_TESTS]: "Unit Tests",
    [CATEGORY_ID.INTEGRATION_TESTS]: "Integration Tests",
    [CATEGORY_ID.BUILD]: "Build Verification",
    [CATEGORY_ID.RUNTIME]: "Runtime Verification",
    [CATEGORY_ID.INFRASTRUCTURE]: "Infrastructure & Environment",
    [CATEGORY_ID.CUSTOM]: "Project-Specific Checks",
} as const satisfies Record<ChecklistCategory, string>;

/** Checklist sections, detected from `## ` headings; labels prefix incomplete items. */
export const CHECKLIST_CATEGORIES = {
    IDS: CATEGORY_ID,
    LABELS: CATEGORY_LABEL,
} as const;
