/**
 * Tool Output Configuration
 */

export const TOOL_OUTPUT = {
    /** Maximum length for healthy output capture */
    MAX_HEALTHY_OUTPUT_LENGTH: 1000,
    /** Threshold for considering output small enough to capture */
    SMALL_OUTPUT_THRESHOLD: 5000,
} as const;
