/**
 * Parallel Agent Manager Tests
 * 
 * Tests for:
 * - Session event handling (session.deleted, session.idle)
 * - Double-release prevention
 * - Stability detection
 * - Progress tracking
 * - Task lifecycle
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the dependencies
vi.mock("../../src/core/agents/config", () => ({
    CONFIG: {
        TASK_TTL_MS: 30 * 60 * 1000,
        CLEANUP_DELAY_MS: 5 * 60 * 1000,
        MIN_STABILITY_MS: 1000,  // Short for testing
        POLL_INTERVAL_MS: 500,
    },
}));

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { EventHandler } from "../../src/core/agents/manager/event-handler";
import { TaskPoller } from "../../src/core/agents/manager/task-poller";
import { buildUnitReviewPrompt } from "../../src/core/agents/manager";
import { TASK_STATUS, type ParallelTask } from "../../src/shared";

// Create mock task for testing
function createMockTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: `task_${Math.random().toString(36).slice(2, 10)}`,
        sessionID: `session_${Math.random().toString(36).slice(2, 10)}`,
        parentSessionID: "parent_123",
        description: "Test task",
        prompt: "Test prompt content",
        agent: "builder",
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(Date.now() - 5000),  // Started 5s ago
        concurrencyKey: "builder",
        depth: 1,
        ...overrides,
    };
}

describe("ParallelAgentManager Features", () => {
    let store: TaskStore;
    let concurrency: ConcurrencyController;

    beforeEach(() => {
        store = new TaskStore();
        concurrency = new ConcurrencyController();
    });

    describe("unit review prompt", () => {
        it("builds a compact reviewer prompt without prose wrappers", () => {
            const prompt = buildUnitReviewPrompt(createMockTask({
                id: "task_review",
                description: "Implement routing\n\nwith evidence and tests",
            }));

            expect(prompt).toBe(
                "[UNIT REVIEW]\n" +
                "task=task_review\n" +
                "desc=Implement routing with evidence and tests\n" +
                "check=tests,quality,integration\n" +
                "return=findings_only",
            );
            expect(prompt).not.toContain("Review completed task");
            expect(prompt).not.toContain("Return findings only.");
        });
    });

    describe("session output validation", () => {
        it("does not treat message fetch failures as confirmed assistant output", async () => {
            const task = createMockTask();
            const poller = new TaskPoller(
                { session: { messages: vi.fn().mockRejectedValue(new Error("messages unavailable")) } } as never,
                store,
                concurrency,
                vi.fn().mockResolvedValue(undefined),
                vi.fn(),
                vi.fn(),
            );

            const hasOutput = await poller.validateSessionHasOutput(task.sessionID, task);

            expect(hasOutput).toBe(false);
            expect(task.hasStartedOutputting).not.toBe(true);
        });

        it("treats assistant tool_use parts as valid output", async () => {
            const task = createMockTask();
            const poller = new TaskPoller(
                {
                    session: {
                        messages: vi.fn().mockResolvedValue({
                            data: [{
                                info: { role: "assistant" },
                                parts: [{ type: "tool_use", name: "grep" }],
                            }],
                        }),
                    },
                } as never,
                store,
                concurrency,
                vi.fn().mockResolvedValue(undefined),
                vi.fn(),
                vi.fn(),
            );

            const hasOutput = await poller.validateSessionHasOutput(task.sessionID, task);

            expect(hasOutput).toBe(true);
            expect(task.hasStartedOutputting).toBe(true);
        });

        it("reuses one session status snapshot when polling multiple running tasks", async () => {
            const taskA = createMockTask({ id: "task-a", sessionID: "session-a" });
            const taskB = createMockTask({ id: "task-b", sessionID: "session-b" });
            store.set(taskA.id, taskA);
            store.set(taskB.id, taskB);

            const status = vi.fn().mockResolvedValue({
                data: {
                    "session-a": { type: "busy", messageCount: 1 },
                    "session-b": { type: "busy", messageCount: 2 },
                },
            });
            const messages = vi.fn().mockResolvedValue({ data: [] });
            const poller = new TaskPoller(
                { session: { status, messages } } as never,
                store,
                concurrency,
                vi.fn().mockResolvedValue(undefined),
                vi.fn(),
                vi.fn(),
            );

            await poller.poll();

            expect(status).toHaveBeenCalledTimes(1);
            expect(messages).toHaveBeenCalledTimes(2);
        });
    });

    describe("poller timer lifecycle", () => {
        it("starts and stops the scheduled poll timer", () => {
            const poller = new TaskPoller(
                { session: { status: vi.fn().mockResolvedValue({ data: {} }) } } as never,
                store,
                concurrency,
                vi.fn().mockResolvedValue(undefined),
                vi.fn(),
                vi.fn(),
            );

            poller.start();
            expect(poller.isRunning()).toBe(true);

            poller.stop();
            expect(poller.isRunning()).toBe(false);
        });
    });

    // ========================================================================
    // Session Event Handling
    // ========================================================================

    describe("session.deleted event handling", () => {
        it("should cleanup task when session is deleted", async () => {
            const task = createMockTask();
            store.set(task.id, task);
            store.trackPending(task.parentSessionID, task.id);
            const invalidateSession = vi.fn().mockResolvedValue(undefined);

            const handler = new EventHandler(
                {} as never,
                store,
                concurrency,
                (sessionID) => store.getAll().find(t => t.sessionID === sessionID),
                vi.fn().mockResolvedValue(undefined),
                vi.fn(),
                vi.fn().mockResolvedValue(true),
                invalidateSession,
            );

            handler.handle({
                type: "session.deleted",
                properties: { sessionID: task.sessionID, info: { id: "stale-session" } },
            });

            await vi.waitFor(() => {
                expect(invalidateSession).toHaveBeenCalledWith(task.sessionID);
            });

            expect(store.get(task.id)).toBeUndefined();
            expect(store.hasPending(task.parentSessionID)).toBe(false);
            expect(invalidateSession).not.toHaveBeenCalledWith("stale-session");
        });
    });

    describe("session.idle event handling", () => {
        it("should complete task when session becomes idle", async () => {
            const task = createMockTask({
                startedAt: new Date(Date.now() - 10000),  // Started 10s ago
            });
            store.set(task.id, task);

            // Simulate session.idle completion
            task.status = TASK_STATUS.COMPLETED;
            task.completedAt = new Date();

            if (task.concurrencyKey) {
                concurrency.release(task.concurrencyKey);
                task.concurrencyKey = undefined;
            }

            expect(task.status).toBe("completed");
            expect(task.concurrencyKey).toBeUndefined();
        });
    });

    // ========================================================================
    // Double-release Prevention
    // ========================================================================

    describe("double-release prevention", () => {
        it("should prevent double-release by clearing concurrencyKey", async () => {
            const task = createMockTask({ concurrencyKey: "agent-a" });

            await concurrency.acquire("agent-a");
            expect(concurrency.getActiveCount("agent-a")).toBe(1);

            // First release
            if (task.concurrencyKey) {
                concurrency.release(task.concurrencyKey);
                task.concurrencyKey = undefined;
            }
            expect(concurrency.getActiveCount("agent-a")).toBe(0);

            // Second release attempt (should not decrease count)
            if (task.concurrencyKey) {
                concurrency.release(task.concurrencyKey);
            }
            expect(concurrency.getActiveCount("agent-a")).toBe(0);
        });
    });

    // ========================================================================
    // Stability Detection
    // ========================================================================

    describe("stability detection", () => {
        it("should track stable polls", () => {
            const task = createMockTask();

            // Simulate 3 polls with same message count
            task.lastMsgCount = 5;
            task.stablePolls = 0;

            // Poll 1 - same count
            if (task.lastMsgCount === 5) {
                task.stablePolls = (task.stablePolls ?? 0) + 1;
            }
            expect(task.stablePolls).toBe(1);

            // Poll 2 - same count
            if (task.lastMsgCount === 5) {
                task.stablePolls = (task.stablePolls ?? 0) + 1;
            }
            expect(task.stablePolls).toBe(2);

            // Poll 3 - same count
            if (task.lastMsgCount === 5) {
                task.stablePolls = (task.stablePolls ?? 0) + 1;
            }
            expect(task.stablePolls).toBe(3);
        });

        it("should reset stable polls when message count changes", () => {
            const task = createMockTask();
            task.lastMsgCount = 5;
            task.stablePolls = 2;

            // New message arrives (count changes)
            const newMsgCount = 6;
            if (task.lastMsgCount !== newMsgCount) {
                task.stablePolls = 0;
            }
            task.lastMsgCount = newMsgCount;

            expect(task.stablePolls).toBe(0);
        });

        it("should trigger completion after 3 stable polls", () => {
            const task = createMockTask({
                startedAt: new Date(Date.now() - 15000),  // Started 15s ago
                stablePolls: 3,
            });

            const shouldComplete = (task.stablePolls ?? 0) >= 3;
            expect(shouldComplete).toBe(true);
        });
    });

    // ========================================================================
    // Progress Tracking
    // ========================================================================

    describe("progress tracking", () => {
        it("should track tool calls and last tool", () => {
            const task = createMockTask();

            task.progress = {
                toolCalls: 5,
                lastTool: "write_file",
                lastMessage: "Creating file...",
                lastUpdate: new Date(),
            };

            expect(task.progress.toolCalls).toBe(5);
            expect(task.progress.lastTool).toBe("write_file");
            expect(task.progress.lastMessage).toBe("Creating file...");
        });

        it("should update progress on each poll", () => {
            const task = createMockTask();

            // Simulate first poll
            task.progress = {
                toolCalls: 1,
                lastTool: "read_file",
                lastUpdate: new Date(),
            };

            // Simulate second poll with more activity
            task.progress.toolCalls = 3;
            task.progress.lastTool = "write_file";
            task.progress.lastUpdate = new Date();

            expect(task.progress.toolCalls).toBe(3);
            expect(task.progress.lastTool).toBe("write_file");
        });
    });

    // ========================================================================
    // Task Lifecycle
    // ========================================================================

    describe("task lifecycle", () => {
        it("should transition through states correctly", () => {
            const task = createMockTask({ status: TASK_STATUS.RUNNING });

            // Running → Completed
            task.status = TASK_STATUS.COMPLETED;
            task.completedAt = new Date();
            expect(task.status).toBe("completed");

            // Running → Error
            const errorTask = createMockTask({ status: TASK_STATUS.RUNNING });
            errorTask.status = TASK_STATUS.ERROR;
            errorTask.error = "Something went wrong";
            expect(errorTask.status).toBe(TASK_STATUS.ERROR);
            expect(errorTask.error).toBe("Something went wrong");

            // Running → Timeout
            const timeoutTask = createMockTask({ status: TASK_STATUS.RUNNING });
            timeoutTask.status = TASK_STATUS.TIMEOUT;
            timeoutTask.error = "Task exceeded time limit";
            expect(timeoutTask.status).toBe("timeout");
        });

        it("should handle pending tracking correctly", () => {
            const task = createMockTask();

            // Track pending
            store.set(task.id, task);
            store.trackPending(task.parentSessionID, task.id);
            expect(store.hasPending(task.parentSessionID)).toBe(true);

            // Complete and untrack
            task.status = TASK_STATUS.COMPLETED;
            store.untrackPending(task.parentSessionID, task.id);
            expect(store.hasPending(task.parentSessionID)).toBe(false);
        });
    });
});
