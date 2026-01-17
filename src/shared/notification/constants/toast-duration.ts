/**
 * Toast Duration Constants
 */

import { TIME } from "../../core/constants/time.js";

export const TOAST_DURATION = {
    /** Extra short: 1.5 seconds */
    EXTRA_SHORT: 1500,
    /** Short: 2 seconds */
    SHORT: 2 * TIME.SECOND,
    /** Medium: 3 seconds */
    MEDIUM: 3 * TIME.SECOND,
    /** Default: 4 seconds */
    DEFAULT: 4 * TIME.SECOND,
    /** Long: 5 seconds */
    LONG: 5 * TIME.SECOND,
    /** Extended: 7 seconds */
    EXTENDED: 7 * TIME.SECOND,
    /** Persistent: 0 (stays until dismissed) */
    PERSISTENT: 0,
} as const;
