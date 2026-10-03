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
    /** Base delay for retry backoff calculation */
    BASE_DELAY_MS: 1 * TIME.SECOND,
    /** Maximum retry multiplier */
    MAX_RETRY_MULTIPLIER: 5,
} as const;


/**
 * History & Storage Limits
 */

export const HISTORY = {
    /** Toast history max entries */
    MAX_TOAST: 50,
    /** Progress store max entries */
    MAX_PROGRESS: 100,
} as const;

export const RECOVERY_PRINCIPLE = "DECOMPOSE → RE-PLAN → ASK. Never give up silently.";
