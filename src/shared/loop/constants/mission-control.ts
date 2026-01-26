/**
 * Mission Control Configuration
 */

import { LIMITS } from "../../core/constants/limits.js";

export const MISSION_CONTROL = {
    DEFAULT_MAX_ITERATIONS: LIMITS.MAX_ITERATIONS,
    DEFAULT_COUNTDOWN_SECONDS: 10,
    STATE_FILE: "loop-state.json",
    STOP_COMMAND: "/stop",
    CANCEL_COMMAND: "/cancel",
    LOG_SOURCE: "mission-loop",
} as const;

/** @deprecated Use MISSION_CONTROL instead */
export const MISSION = MISSION_CONTROL;
