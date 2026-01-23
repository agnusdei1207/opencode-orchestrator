
/**
 * Hook Constants
 * Defines strict constant values for hook actions and statuses.
 */

import { HOOK_NAMES as SHARED_HOOK_NAMES } from "../shared/index.js";

export const HOOK_ACTIONS = {
    // General Actions
    CONTINUE: "continue",
    STOP: "stop",

    // Pre-Tool Actions
    ALLOW: "allow",
    BLOCK: "block",
    MODIFY: "modify",

    // Post-Tool Actions (result-based)
    INJECT: "inject",

    // Chat Actions
    PROCESS: "process",
    INTERCEPT: "intercept",
} as const;

export const HOOK_NAMES = SHARED_HOOK_NAMES;

// Type helper to extract values if needed, though we use literals in types currently.
// export type HookActionType = typeof HOOK_ACTIONS[keyof typeof HOOK_ACTIONS];
