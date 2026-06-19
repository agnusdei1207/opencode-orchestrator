/**
 * Recovery constants (consolidated)
 */
import { TIME } from "../core/constants.js";

/**
 * Recovery Configuration Constants
 */


export const RECOVERY = {
    /** Maximum recovery attempts per session */
    MAX_ATTEMPTS: 3,
    /** Minimum time between recovery attempts */
    MIN_INTERVAL_MS: 30 * TIME.SECOND,
    /** Base delay for retry backoff calculation */
    BASE_DELAY_MS: 1 * TIME.SECOND,
    /** Maximum retry multiplier */
    MAX_RETRY_MULTIPLIER: 5,
} as const;


/**
 * History & Storage Limits
 */

export const HISTORY = {
    /** Recovery history max entries */
    MAX_RECOVERY: 100,
    /** Toast history max entries */
    MAX_TOAST: 50,
    /** Progress store max entries */
    MAX_PROGRESS: 100,
} as const;

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

