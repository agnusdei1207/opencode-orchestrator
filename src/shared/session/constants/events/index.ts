/**
 * Combined Event Constants
 */

import { TASK_EVENTS } from "./task-events.js";
import { TODO_EVENTS } from "./todo-events.js";
import { SESSION_EVENTS } from "./session-events.js";
import { DOCUMENT_EVENTS } from "./document-events.js";
import { MISSION_EVENTS } from "./mission-events.js";
import { MESSAGE_EVENTS } from "./message-events.js";
import { SPECIAL_EVENTS } from "./special-events.js";
import { HOOK_EVENTS } from "./hook-events.js";

export const EVENT_TYPES = {
    ...TASK_EVENTS,
    ...TODO_EVENTS,
    ...SESSION_EVENTS,
    ...DOCUMENT_EVENTS,
    ...MISSION_EVENTS,
    ...MESSAGE_EVENTS,
    ...SPECIAL_EVENTS,
    ...HOOK_EVENTS,
} as const;

export type EventTypeValue = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export * from "./task-events.js";
export * from "./todo-events.js";
export * from "./session-events.js";
export * from "./document-events.js";
export * from "./mission-events.js";
export * from "./message-events.js";
export * from "./special-events.js";
export * from "./hook-events.js";
