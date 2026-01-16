/**
 * Event Bus Types (Type Aliases Only)
 */

import type { EventTypeValue } from "../../shared/event-types.js";

/**
 * Event type - allows constants or custom strings
 */
export type EventType = EventTypeValue | (string & {});

/**
 * Properties payload for events
 */
export type EventProperties = Record<string, unknown>;
