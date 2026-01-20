/**
 * Mission Seal Configuration
 */

import { LIMITS } from "../../core/constants/limits.js";

export const MISSION_SEAL = {
    TAG: "mission_seal",
    CONFIRMATION: "SEALED",
    PATTERN: "<mission_seal>SEALED</mission_seal>",
    DEFAULT_MAX_ITERATIONS: LIMITS.MAX_ITERATIONS,
    DEFAULT_COUNTDOWN_SECONDS: 3,
    STATE_FILE: "loop-state.json",
    STOP_COMMAND: "/stop",
    CANCEL_COMMAND: "/cancel",
} as const;


/** @deprecated Use MISSION_SEAL instead */
export const MISSION = MISSION_SEAL;
