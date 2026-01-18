/**
 * Slash Commands (with slash prefix)
 */
export const SLASH_COMMANDS = {
    TASK: "/task",
    PLAN: "/plan",
    STATUS: "/status",
    STOP: "/stop",
    CANCEL: "/cancel",
} as const;

/**
 * Command Names (without slash prefix, for comparison after parsing)
 */
export const COMMAND_NAMES = {
    TASK: "task",
    PLAN: "plan",
    STATUS: "status",
    STOP: "stop",
    CANCEL: "cancel",
} as const;

export type CommandName = typeof COMMAND_NAMES[keyof typeof COMMAND_NAMES];
