/**
 * Event Bus Implementation
 * 
 * Core pub/sub system for communication between sessions and agents
 */

import { SPECIAL_EVENTS } from "../../shared/event-types.js";
import type { EventType } from "./types.js";
import type { BusEvent, EventHandler, Subscription, PublishOptions } from "./interfaces.js";

export class EventBusImpl {
    private subscriptions = new Map<EventType, Subscription[]>();
    private eventHistory: BusEvent[] = [];
    private maxHistorySize = 100;
    private subscriptionCounter = 0;

    /**
     * Subscribe to an event type
     * Returns unsubscribe function
     */
    subscribe(type: EventType, handler: EventHandler): () => void {
        const id = `sub_${++this.subscriptionCounter}`;
        const subscription: Subscription = { id, type, handler, once: false };

        const existing = this.subscriptions.get(type) || [];
        existing.push(subscription);
        this.subscriptions.set(type, existing);

        return () => this.unsubscribe(id, type);
    }

    /**
     * Subscribe to an event type, auto-unsubscribe after first event
     */
    once(type: EventType, handler: EventHandler): () => void {
        const id = `sub_${++this.subscriptionCounter}`;
        const subscription: Subscription = { id, type, handler, once: true };

        const existing = this.subscriptions.get(type) || [];
        existing.push(subscription);
        this.subscriptions.set(type, existing);

        return () => this.unsubscribe(id, type);
    }

    /**
     * Unsubscribe from an event
     */
    private unsubscribe(id: string, type: EventType): void {
        const subs = this.subscriptions.get(type);
        if (subs) {
            const filtered = subs.filter(s => s.id !== id);
            if (filtered.length > 0) {
                this.subscriptions.set(type, filtered);
            } else {
                this.subscriptions.delete(type);
            }
        }
    }

    /**
     * Publish an event
     */
    async publish(
        type: EventType,
        properties: Record<string, unknown> = {},
        options: { source?: string; sessionId?: string } = {}
    ): Promise<void> {
        const event: BusEvent = {
            type,
            timestamp: new Date(),
            source: options.source || "unknown",
            sessionId: options.sessionId,
            properties,
        };

        // Add to history
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        // Notify subscribers
        const toNotify: Subscription[] = [];

        // Get specific type subscribers
        const typeSubs = this.subscriptions.get(type) || [];
        toNotify.push(...typeSubs);

        // Get wildcard subscribers
        const wildcardSubs = this.subscriptions.get(SPECIAL_EVENTS.WILDCARD) || [];
        toNotify.push(...wildcardSubs);

        // Execute handlers
        const toRemove: { id: string; type: EventType }[] = [];

        for (const sub of toNotify) {
            try {
                await sub.handler(event);
            } catch (error) {
                console.error(`[EventBus] Handler error for ${type}:`, error);
            }

            if (sub.once) {
                toRemove.push({ id: sub.id, type: sub.type });
            }
        }

        // Remove one-time subscriptions
        for (const { id, type: t } of toRemove) {
            this.unsubscribe(id, t);
        }
    }

    /**
     * Emit (alias for publish, sync-looking API)
     */
    emit(type: EventType, properties: Record<string, unknown> = {}): void {
        this.publish(type, properties).catch(console.error);
    }

    /**
     * Get recent event history
     */
    getHistory(type?: EventType, limit = 20): BusEvent[] {
        let events = this.eventHistory;

        if (type && type !== SPECIAL_EVENTS.WILDCARD) {
            events = events.filter(e => e.type === type);
        }

        return events.slice(-limit);
    }

    /**
     * Clear all subscriptions
     */
    clear(): void {
        this.subscriptions.clear();
        this.eventHistory = [];
    }

    /**
     * Get subscription count
     */
    getSubscriptionCount(): number {
        let count = 0;
        for (const subs of this.subscriptions.values()) {
            count += subs.length;
        }
        return count;
    }

    /**
     * Wait for a specific event (Promise-based)
     */
    waitFor(type: EventType, timeout = 30000): Promise<BusEvent> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout waiting for event: ${type}`));
            }, timeout);

            const unsubscribe = this.once(type, (event) => {
                clearTimeout(timer);
                resolve(event);
            });
        });
    }
}
