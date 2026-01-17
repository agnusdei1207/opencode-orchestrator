/**
 * Cache Configuration Constants
 */

import { TIME } from "../../core/constants/time.js";

export const CACHE = {
    /** Default cache TTL (24 hours) */
    DEFAULT_TTL_MS: 24 * TIME.HOUR,
    /** Maximum cache entries */
    MAX_ENTRIES: 100,
    /** Session TTL (24 hours for long tasks) */
    SESSION_TTL_MS: 24 * TIME.HOUR,
} as const;
