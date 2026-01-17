/**
 * OpenCode Session Event Types
 */

export const SESSION_EVENTS = {
    IDLE: "session.idle",
    DELETED: "session.deleted",
    CREATED: "session.created",
    ERROR: "session.error",
} as const;

export type SessionEventType = (typeof SESSION_EVENTS)[keyof typeof SESSION_EVENTS];
