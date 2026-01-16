/**
 * Event Types Constants
 * 
 * All event types used in the Event Bus system
 * Import and use these instead of hardcoded strings
 */

/**
 * Task lifecycle events
 */
export const TASK_EVENTS = {
    STARTED: "task.started",
    COMPLETED: "task.completed",
    FAILED: "task.failed",
    CANCELLED: "task.cancelled",
} as const;

/**
 * Todo lifecycle events
 */
export const TODO_EVENTS = {
    CREATED: "todo.created",
    UPDATED: "todo.updated",
    COMPLETED: "todo.completed",
} as const;

/**
 * Session state events
 */
export const SESSION_EVENTS = {
    IDLE: "session.idle",
    BUSY: "session.busy",
    ERROR: "session.error",
    DELETED: "session.deleted",
} as const;

/**
 * Document cache events
 */
export const DOCUMENT_EVENTS = {
    CACHED: "document.cached",
    EXPIRED: "document.expired",
} as const;

/**
 * Mission lifecycle events
 */
export const MISSION_EVENTS = {
    COMPLETE: "mission.complete",
    FAILED: "mission.failed",
    ALL_TASKS_COMPLETE: "all_tasks.complete",
} as const;

/**
 * Special event types
 */
export const SPECIAL_EVENTS = {
    WILDCARD: "*",
} as const;

/**
 * All event types combined
 */
export const EVENT_TYPES = {
    ...TASK_EVENTS,
    ...TODO_EVENTS,
    ...SESSION_EVENTS,
    ...DOCUMENT_EVENTS,
    ...MISSION_EVENTS,
    ...SPECIAL_EVENTS,
} as const;

/**
 * Type for all possible event type values
 */
export type EventTypeValue = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
