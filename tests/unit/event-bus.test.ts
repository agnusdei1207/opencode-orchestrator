/**
 * EventBus Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/core/bus/index";

describe("EventBus", () => {
    beforeEach(() => {
        EventBus.clear();
    });

    describe("subscribe", () => {
        it("should subscribe to events and receive them", async () => {
            const handler = vi.fn();
            EventBus.subscribe("task.started", handler);

            await EventBus.publish("task.started", { taskId: "test_123" });

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "task.started",
                    properties: { taskId: "test_123" },
                })
            );
        });

        it("should allow multiple subscribers for same event", async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            EventBus.subscribe("task.completed", handler1);
            EventBus.subscribe("task.completed", handler2);

            await EventBus.publish("task.completed", { taskId: "test_456" });

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it("should unsubscribe correctly", async () => {
            const handler = vi.fn();
            const unsubscribe = EventBus.subscribe("task.failed", handler);

            await EventBus.publish("task.failed", {});
            expect(handler).toHaveBeenCalledTimes(1);

            unsubscribe();

            await EventBus.publish("task.failed", {});
            expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
        });
    });

    describe("once", () => {
        it("should only trigger once then auto-unsubscribe", async () => {
            const handler = vi.fn();
            EventBus.once("mission.complete", handler);

            await EventBus.publish("mission.complete", {});
            await EventBus.publish("mission.complete", {});
            await EventBus.publish("mission.complete", {});

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe("wildcard subscription", () => {
        it("should receive all events with * subscription", async () => {
            const handler = vi.fn();
            EventBus.subscribe("*", handler);

            await EventBus.publish("task.started", {});
            await EventBus.publish("task.completed", {});
            await EventBus.publish("mission.complete", {});

            expect(handler).toHaveBeenCalledTimes(3);
        });
    });

    describe("event history", () => {
        it("should maintain event history", async () => {
            await EventBus.publish("task.started", { id: 1 });
            await EventBus.publish("task.completed", { id: 2 });

            const history = EventBus.getHistory();
            expect(history.length).toBe(2);
            expect(history[0].type).toBe("task.started");
            expect(history[1].type).toBe("task.completed");
        });

        it("should filter history by type", async () => {
            await EventBus.publish("task.started", { id: 1 });
            await EventBus.publish("task.completed", { id: 2 });
            await EventBus.publish("task.started", { id: 3 });

            const startedHistory = EventBus.getHistory("task.started");
            expect(startedHistory.length).toBe(2);
        });
    });

    describe("waitFor", () => {
        it("should wait for a specific event", async () => {
            const promise = EventBus.waitFor("session.idle", 5000);

            // Publish after a short delay
            setTimeout(() => {
                EventBus.emit("session.idle", { sessionId: "test" });
            }, 100);

            const event = await promise;
            expect(event.type).toBe("session.idle");
            expect(event.properties.sessionId).toBe("test");
        });

        it("should timeout if event not received", async () => {
            await expect(
                EventBus.waitFor("document.expired", 100)
            ).rejects.toThrow("Timeout");
        });
    });

    describe("subscription count", () => {
        it("should track subscription count", () => {
            expect(EventBus.getSubscriptionCount()).toBe(0);

            const unsub1 = EventBus.subscribe("task.started", () => { });
            const unsub2 = EventBus.subscribe("task.completed", () => { });

            expect(EventBus.getSubscriptionCount()).toBe(2);

            unsub1();
            expect(EventBus.getSubscriptionCount()).toBe(1);

            unsub2();
            expect(EventBus.getSubscriptionCount()).toBe(0);
        });
    });
});
