/**
 * Recovery Configuration Constants
 */

import { TIME } from "../../core/constants/time.js";

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

