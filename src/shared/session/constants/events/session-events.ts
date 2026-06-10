/**
 * Session state events
 */
export const SESSION_EVENTS = {
    IDLE: "session.idle",
    STATUS: "session.status",
    UPDATED: "session.updated",
    COMPACTED: "session.compacted",
    BUSY: "session.busy",
    ERROR: "session.error",
    DELETED: "session.deleted",
    CREATED: "session.created",
} as const;
