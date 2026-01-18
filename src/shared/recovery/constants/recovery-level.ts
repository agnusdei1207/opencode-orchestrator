/**
 * Recovery Level Constants
 * 
 * Escalation levels for agent failure handling.
 */

export const RECOVERY_LEVEL = {
    /** Level 1: Split task into smaller units */
    DECOMPOSE: "DECOMPOSE",
    /** Level 2: Step back and create new strategy */
    RE_PLAN: "RE-PLAN",
    /** Level 3: Ask user for direction */
    ASK_USER: "ASK USER",
} as const;

export const RECOVERY_PRINCIPLE = "DECOMPOSE → RE-PLAN → ASK. Never give up silently.";

export type RecoveryLevel = (typeof RECOVERY_LEVEL)[keyof typeof RECOVERY_LEVEL];
