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
} as const;

export const RECOVERY_PRINCIPLE = "DECOMPOSE → RE-PLAN → ASK. Never give up silently.";
