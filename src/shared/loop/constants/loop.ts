/**
 * Loop Continuation Configuration
 */

import { TIME } from "../../core/constants/time.js";

export const LOOP = {
    /** Countdown seconds before auto-continuation */
    COUNTDOWN_SECONDS: 3,
    /** Minimum time between continuation checks */
    MIN_TIME_BETWEEN_CHECKS_MS: 3 * TIME.SECOND,
    /** Grace period after countdown starts (ignore messages) */
    COUNTDOWN_GRACE_PERIOD_MS: 500,
    /** Window to consider abort as recent */
    ABORT_WINDOW_MS: 3 * TIME.SECOND,
    /** Maximum iterations for mission loop */
    DEFAULT_MAX_ITERATIONS: 1000,
    /** Rust tool timeout */
    RUST_TOOL_TIMEOUT_MS: 60 * TIME.SECOND,
} as const;
