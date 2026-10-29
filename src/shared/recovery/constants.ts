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
    /** Minimum gap between two recovery attempts for one session */
    RETRY_COOLDOWN_MS: 30 * TIME.SECOND,
} as const;

export const RECOVERY_PRINCIPLE = "DECOMPOSE → RE-PLAN → ASK. Never give up silently.";
