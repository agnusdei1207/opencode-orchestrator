/**
 * Event Bus System
 * 
 * Pub/Sub system for communication between sessions and agents
 * Enables loose coupling and async event handling
 */

// Re-export types (type aliases)
export type { EventType, EventProperties } from "./types.js";

// Re-export interfaces
export type { BusEvent, EventHandler, Subscription, PublishOptions } from "./interfaces.js";

// Re-export event type constants
export {
    EVENT_TYPES,
    TASK_EVENTS,
    TODO_EVENTS,
    SESSION_EVENTS,
    DOCUMENT_EVENTS,
    MISSION_EVENTS,
    SPECIAL_EVENTS,
} from "../../shared/event-types.js";

// Import implementation
import { EventBusImpl } from "./event-bus.js";
import type { EventType, EventProperties } from "./types.js";
import type { EventHandler } from "./interfaces.js";

// Singleton instance
export const EventBus = new EventBusImpl();

// Convenience functions
export function subscribe(type: EventType, handler: EventHandler): () => void {
    return EventBus.subscribe(type, handler);
}

export function publish(
    type: EventType,
    properties?: EventProperties,
    options?: { source?: string; sessionId?: string }
): Promise<void> {
    return EventBus.publish(type, properties, options);
}

export function emit(type: EventType, properties?: EventProperties): void {
    EventBus.emit(type, properties);
}
