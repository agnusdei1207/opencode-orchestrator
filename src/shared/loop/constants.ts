/**
 * Loop constants (consolidated)
 */
import { TIME } from "../core/constants.js";

/**
 * Loop Continuation Configuration
 */


export const LOOP = {
    /** Minimum time between continuation checks */
    MIN_TIME_BETWEEN_CHECKS_MS: 3 * TIME.SECOND,
} as const;

/**
 * Mission Control Configuration
 */


export const MISSION_CONTROL = {
    DEFAULT_COUNTDOWN_SECONDS: 3,
    STATE_FILE: "loop-state.json",
    LOG_SOURCE: "mission-loop",
} as const;



