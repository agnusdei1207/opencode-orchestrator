/**
 * Background Task Configuration
 */

import { TIME } from "../../core/constants/time.js";

export const BACKGROUND_TASK = {
    DEFAULT_TIMEOUT_MS: 5 * TIME.MINUTE,
    MAX_OUTPUT_LENGTH: 10000,
    MAX_CONCURRENT: 5,
    POLL_INTERVAL_MS: 500,
    RETRY_COOLDOWN_MS: 30 * TIME.SECOND,
} as const;
