/**
 * Event Bus Interfaces
 */

import type { EventType, EventProperties } from "./types.js";

/**
 * Event payload structure
 */
export interface BusEvent {
    type: EventType;
    timestamp: Date;
    source: string;
    sessionId?: string;
    properties: EventProperties;
}

/**
 * Event handler function signature
 */
export type EventHandler = (event: BusEvent) => void | Promise<void>;

/**
 * Internal subscription record
 */
export interface Subscription {
    id: string;
    type: EventType;
    handler: EventHandler;
    once: boolean;
}

/**
 * Publish options
 */
export interface PublishOptions {
    source?: string;
    sessionId?: string;
}
