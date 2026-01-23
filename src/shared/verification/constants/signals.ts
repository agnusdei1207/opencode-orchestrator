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
