/**
 * Verification Checklist Constants
 * 
 * File paths and configuration for the verification checklist system.
 */

import { PATHS } from "../../core/constants/paths.js";

/**
 * Checklist file and configuration constants
 */
export const CHECKLIST = {
    /** Path to the verification checklist file */
    FILE: PATHS.VERIFICATION_CHECKLIST,

    /** Minimum required items for valid checklist */
    MIN_ITEMS: 1,

    /** Maximum items to show in error messages */
    MAX_ERROR_ITEMS: 5,
} as const;
