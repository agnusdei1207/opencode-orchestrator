
/**
 * Hook Constants
 * Defines strict constant values for hook actions and statuses.
 */

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

export const HOOK_NAMES = {
    SANITY_CHECK: "SanityCheck",
    MISSION_LOOP: "MissionLoop",
    STRICT_ROLE_GUARD: "StrictRoleGuard",
    SECRET_SCANNER: "SecretScanner",
    AGENT_UI: "AgentUI",
    RESOURCE_CONTROL: "ResourceControl",
    SLASH_COMMAND: "SlashCommandDispatcher",
    USER_ACTIVITY: "UserActivity",
} as const;

// Type helper to extract values if needed, though we use literals in types currently.
// export type HookActionType = typeof HOOK_ACTIONS[keyof typeof HOOK_ACTIONS];
