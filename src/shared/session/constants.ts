/**
 * Session constants (consolidated)
 */

/**
 * Session state events, as published by OpenCode.
 *
 * There is no `session.busy` event upstream: a session going to work is
 * reported as `session.status` carrying a `busy` status. Listen on `STATUS` and
 * read the payload's status type (see `SESSION_STATUS`).
 */
export const SESSION_EVENTS = {
    IDLE: "session.idle",
    STATUS: "session.status",
    UPDATED: "session.updated",
    COMPACTED: "session.compacted",
    ERROR: "session.error",
    DELETED: "session.deleted",
    CREATED: "session.created",
} as const;

/**
 * Message Event Types
 */
export const MESSAGE_EVENTS = {
    UPDATED: "message.updated",
    PART_UPDATED: "message.part.updated",
} as const;
