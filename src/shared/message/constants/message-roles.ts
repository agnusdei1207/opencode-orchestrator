/**
 * Message Role Constants
 * 
 * OpenCode message roles
 * Use these instead of hardcoded strings
 */

export const MESSAGE_ROLES = {
    /** AI assistant message */
    ASSISTANT: "assistant",
    /** User message */
    USER: "user",
    /** System message */
    SYSTEM: "system",
} as const;

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES];

/**
 * Session Status Types
 */
export const SESSION_STATUS = {
    IDLE: "idle",
    BUSY: "busy",
} as const;

export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
