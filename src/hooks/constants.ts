
/**
 * Hook Constants
 * Defines strict constant values for hook actions and statuses.
 */

import { HOOK_NAMES as SHARED_HOOK_NAMES } from "../shared/index.js";

export const HOOK_ACTIONS = {
    // General Actions
    CONTINUE: "continue",

    // Pre-Tool Actions
    ALLOW: "allow",
    BLOCK: "block",

    // Post-Tool Actions (result-based)
    INJECT: "inject",

    // Chat Actions
    PROCESS: "process",
    INTERCEPT: "intercept",
} as const;

export const HOOK_NAMES = SHARED_HOOK_NAMES;
