/**
 * Background Task Configuration
 */

import { TIME } from "./time.js";

export const BACKGROUND_TASK = {
    DEFAULT_TIMEOUT_MS: 5 * TIME.MINUTE,
    MAX_OUTPUT_LENGTH: 10000,
} as const;
