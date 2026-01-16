/**
 * Integration Tests - Event Bus and Core Systems
 * 
 * Tests interaction between Event Bus, Toast, Progress Tracker, etc.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    EventBus,
    TASK_EVENTS,
    TODO_EVENTS,
    SESSION_EVENTS,
    DOCUMENT_EVENTS,
    MISSION_EVENTS,
    SPECIAL_EVENTS
} from "../../src/core/bus/index";
import * as Toast from "../../src/core/notification/toast";
import * as ProgressTracker from "../../src/core/progress/tracker";
import * as AutoRecovery from "../../src/core/recovery/auto-recovery";
import * as SharedContext from "../../src/core/session/shared-context";
import * as TaskDecomposer from "../../src/core/task/task-decomposer";

describe("Integration: Event Bus and Core Systems", () => {
    beforeEach(() => {
        EventBus.clear();
        Toast.clear();
        SharedContext.clearAll();
    });

    describe("Event Bus → Toast Integration", () => {
        it("should show toast on task.completed event via enableAutoToasts", async () => {
            const toastHandler = vi.fn();
            Toast.onToast(toastHandler);

            // Enable auto toasts
            const cleanup = Toast.enableAutoToasts();

            // Publish event using constant
            await EventBus.publish(TASK_EVENTS.COMPLETED, {
                taskId: "task_123",
                agent: "builder"
            });

            expect(toastHandler).toHaveBeenCalled();
            cleanup();
        });

        it("should show toast on task.failed event", async () => {
            const toastHandler = vi.fn();
            Toast.onToast(toastHandler);

            const cleanup = Toast.enableAutoToasts();

            await EventBus.publish(TASK_EVENTS.FAILED, {
                taskId: "task_456",
                error: "Build failed"
            });

            expect(toastHandler).toHaveBeenCalled();
            const toast = toastHandler.mock.calls[0][0];
            expect(toast.variant).toBe("error");
            cleanup();
        });
    });

    describe("Event Bus → Auto Recovery Integration", () => {
        it("should emit session.error event on recovery", async () => {
            const errorHandler = vi.fn();
            EventBus.subscribe(SESSION_EVENTS.ERROR, errorHandler);

            AutoRecovery.handleError({
                sessionId: "test_session",
                error: new Error("Rate limit exceeded"),
                attempt: 1,
                timestamp: new Date(),
            });

            // Wait for async event
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(errorHandler).toHaveBeenCalled();
        });
    });

    describe("Session Context Sharing", () => {
        it("should share documents between parent and child sessions", () => {
            // Parent session caches a document
            SharedContext.create("parent_session");
            SharedContext.addDocument("parent_session", {
                url: "https://docs.example.com/api",
                filename: "api_docs.md",
                title: "API Documentation",
                cachedAt: new Date(),
            });

            // Child session created from parent
            SharedContext.create("child_session", "parent_session");

            // Child should have access to parent's documents
            const merged = SharedContext.getMerged("child_session");
            expect(merged?.documents.has("api_docs.md")).toBe(true);
        });

        it("should share findings between sessions", () => {
            SharedContext.create("parent");
            SharedContext.addFinding("parent", {
                content: "Use async/await for API calls",
                source: "code review",
                category: "pattern",
            });

            SharedContext.create("child", "parent");

            const merged = SharedContext.getMerged("child");
            expect(merged?.findings.length).toBe(1);
            expect(merged?.findings[0].content).toContain("async/await");
        });
    });

    describe("Task Decomposer → Progress Tracker Integration", () => {
        const SESSION_ID = "test_integration";

        beforeEach(() => {
            TaskDecomposer.clear(SESSION_ID);
            ProgressTracker.clearSession(SESSION_ID);
        });

        it("should track progress through task decomposition", () => {
            ProgressTracker.startSession(SESSION_ID);

            // Create task hierarchy
            TaskDecomposer.create(SESSION_ID, "Main mission");
            const task1 = TaskDecomposer.addTask(SESSION_ID, {
                description: "Task 1",
                level: 1,
            });
            TaskDecomposer.addTask(SESSION_ID, {
                description: "Task 2",
                level: 1,
            });

            // Record progress
            const progress = TaskDecomposer.getProgress(SESSION_ID);
            ProgressTracker.recordSnapshot(SESSION_ID, {
                taskTotal: progress.total,
                taskCompleted: progress.completed,
                taskRunning: progress.running,
            });

            // Update task
            TaskDecomposer.updateStatus(SESSION_ID, task1.id, "completed");

            // Record new progress
            const newProgress = TaskDecomposer.getProgress(SESSION_ID);
            ProgressTracker.recordSnapshot(SESSION_ID, {
                taskTotal: newProgress.total,
                taskCompleted: newProgress.completed,
            });

            // Verify progress tracking
            const history = ProgressTracker.getHistory(SESSION_ID);
            expect(history.length).toBe(2);
            expect(history[1].tasks.completed).toBe(1);
        });
    });

    describe("Event Bus Wildcard Subscriptions", () => {
        it("should receive all events with wildcard", async () => {
            const allEvents: string[] = [];

            EventBus.subscribe(SPECIAL_EVENTS.WILDCARD, (event) => {
                allEvents.push(event.type);
            });

            await EventBus.publish(TASK_EVENTS.STARTED, { taskId: "1" });
            await EventBus.publish(TODO_EVENTS.COMPLETED, { todoId: "2" });
            await EventBus.publish(SESSION_EVENTS.IDLE, { sessionId: "3" });

            expect(allEvents).toContain(TASK_EVENTS.STARTED);
            expect(allEvents).toContain(TODO_EVENTS.COMPLETED);
            expect(allEvents).toContain(SESSION_EVENTS.IDLE);
        });
    });

    describe("Event History", () => {
        it("should maintain event history for debugging", async () => {
            await EventBus.publish(TASK_EVENTS.STARTED, { taskId: "t1" });
            await EventBus.publish(TASK_EVENTS.COMPLETED, { taskId: "t1" });
            await EventBus.publish(TASK_EVENTS.STARTED, { taskId: "t2" });

            const history = EventBus.getHistory();
            expect(history.length).toBe(3);

            const startedHistory = EventBus.getHistory(TASK_EVENTS.STARTED);
            expect(startedHistory.length).toBe(2);
        });
    });

    describe("Cross-Component Communication", () => {
        it("should coordinate between components via events", async () => {
            const events: string[] = [];

            // Subscribe to events from different components using constants
            EventBus.subscribe(TASK_EVENTS.STARTED, () => { events.push("task_started"); });
            EventBus.subscribe(DOCUMENT_EVENTS.CACHED, () => { events.push("doc_cached"); });
            EventBus.subscribe(MISSION_EVENTS.COMPLETE, () => { events.push("mission_done"); });

            // Simulate workflow
            await EventBus.publish(TASK_EVENTS.STARTED, { taskId: "main" });
            await EventBus.publish(DOCUMENT_EVENTS.CACHED, { filename: "docs.md" });
            await EventBus.publish(MISSION_EVENTS.COMPLETE, { summary: "All done" });

            expect(events).toEqual(["task_started", "doc_cached", "mission_done"]);
        });
    });
});
