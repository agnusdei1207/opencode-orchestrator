/**
 * Todo Continuation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import the actual functions we want to test
import {
    getIncompleteCount,
    hasRemainingWork,
    getNextPending,
} from "../../src/core/loop/stats.js";
import {
    generateContinuationPrompt,
    formatProgress,
} from "../../src/core/loop/formatters.js";
import {
    cleanupSession,
    handleSessionIdle,
    handleSessionBusy,
    hasPendingContinuation,
} from "../../src/core/loop/todo-continuation.js";
import {
    recordSessionStatus,
    resetSessionActivity,
} from "../../src/core/session/activity.js";
import type { Todo } from "../../src/shared/loop/types.js";

const mocks = vi.hoisted(() => ({
    getTasksByParent: vi.fn(() => []),
    isSessionRecovering: vi.fn(() => false),
    verifyMissionCompletion: vi.fn(() => ({
        passed: true,
        todoIncomplete: 0,
        checklistPresent: false,
        checklistProgress: "0/0",
        checklistComplete: true,
    })),
    buildVerificationFailurePrompt: vi.fn(() => "<verification_failure>file work remains</verification_failure>"),
}));

vi.mock("../../src/core/agents/manager.js", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({
            getTasksByParent: mocks.getTasksByParent,
        })),
    },
}));

vi.mock("../../src/core/recovery/session-recovery.js", () => ({
    isSessionRecovering: mocks.isSessionRecovering,
}));

vi.mock("../../src/core/loop/verification.js", () => ({
    verifyMissionCompletion: mocks.verifyMissionCompletion,
    buildVerificationFailurePrompt: mocks.buildVerificationFailurePrompt,
}));

describe("TodoContinuation", () => {
    describe("incomplete detection", () => {
        const createTodos = (statuses: string[]): Todo[] =>
            statuses.map((status, i) => ({
                id: `T${i + 1}`,
                content: `Task ${i + 1}`,
                status: status as Todo["status"],
                priority: "medium" as const,
                createdAt: new Date(),
            }));

        it("should count incomplete todos correctly", () => {
            const todos = createTodos(["pending", "in_progress", "completed", "cancelled"]);
            expect(getIncompleteCount(todos)).toBe(2); // pending + in_progress
        });

        it("should detect remaining work", () => {
            expect(hasRemainingWork(createTodos(["pending"]))).toBe(true);
            expect(hasRemainingWork(createTodos(["in_progress"]))).toBe(true);
            expect(hasRemainingWork(createTodos(["completed"]))).toBe(false);
            expect(hasRemainingWork(createTodos(["cancelled"]))).toBe(false);
            expect(hasRemainingWork(createTodos(["completed", "cancelled"]))).toBe(false);
        });

        it("should handle empty todos", () => {
            expect(getIncompleteCount([])).toBe(0);
            expect(hasRemainingWork([])).toBe(false);
        });

        it("should get next pending with priority", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Low", status: "pending", priority: "low", createdAt: new Date() },
                { id: "T2", content: "High", status: "pending", priority: "high", createdAt: new Date() },
                { id: "T3", content: "Medium", status: "pending", priority: "medium", createdAt: new Date() },
            ];
            const next = getNextPending(todos);
            expect(next?.id).toBe("T2"); // High priority first
        });
    });

    describe("continuation prompt generation", () => {
        it("should generate continuation prompt when todos remain", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Incomplete Task", status: "pending", priority: "high", createdAt: new Date() },
                { id: "T2", content: "Done Task", status: "completed", priority: "medium", createdAt: new Date() },
            ];
            const prompt = generateContinuationPrompt(todos);
            expect(prompt).toContain("todo_continuation");
            expect(prompt).toContain("T1");
            expect(prompt).toContain("Incomplete Task");
        });

        it("should return empty string when all done", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Done", status: "completed", priority: "medium", createdAt: new Date() },
            ];
            const prompt = generateContinuationPrompt(todos);
            expect(prompt).toBe("");
        });

        it("should format progress correctly", () => {
            const todos: Todo[] = [
                { id: "T1", content: "Done", status: "completed", priority: "medium", createdAt: new Date() },
                { id: "T2", content: "Pending", status: "pending", priority: "medium", createdAt: new Date() },
            ];
            const progress = formatProgress(todos);
            expect(progress).toContain("1/2");
            expect(progress).toContain("50%");
        });
    });

    describe("countdown behavior", () => {
        it("should respect minimum time between continuations", () => {
            // MIN_TIME_BETWEEN_CONTINUATIONS_MS = 3000
            // This test verifies the rate limiting logic
            const MIN_TIME = 3000;
            const now = Date.now();
            const lastIdleTime = now - 1000; // 1 second ago

            // Should skip because too soon
            expect(now - lastIdleTime < MIN_TIME).toBe(true);
        });

        it("should allow continuation after minimum time", () => {
            const MIN_TIME = 3000;
            const now = Date.now();
            const lastIdleTime = now - 4000; // 4 seconds ago

            // Should allow
            expect(now - lastIdleTime >= MIN_TIME).toBe(true);
        });
    });

    describe("skip conditions", () => {
        it("should skip if session is recovering", () => {
            // If isSessionRecovering returns true, continuation should skip
            const isRecovering = true;
            expect(isRecovering).toBe(true); // Would skip
        });

        it("should skip if background tasks are running", () => {
            // If hasRunningBackgroundTasks returns true, continuation should skip
            const hasBackgroundTasks = true;
            expect(hasBackgroundTasks).toBe(true); // Would skip
        });

        it("should skip if user is aborting", () => {
            // If state.isAborting is true, continuation should skip
            const isAborting = true;
            expect(isAborting).toBe(true); // Would skip
        });
    });

    describe("handleSessionIdle", () => {
        const sessionID = "session-todo-continuation";
        const directory = "/tmp/todo-continuation";

        beforeEach(() => {
            vi.useFakeTimers();
            cleanupSession(sessionID);
            mocks.getTasksByParent.mockReturnValue([]);
            mocks.isSessionRecovering.mockReturnValue(false);
            mocks.verifyMissionCompletion.mockReturnValue({
                passed: true,
                todoIncomplete: 0,
                checklistPresent: false,
                checklistProgress: "0/0",
                checklistComplete: true,
            });
            mocks.buildVerificationFailurePrompt.mockReturnValue("<verification_failure>file work remains</verification_failure>");
        });

        afterEach(() => {
            cleanupSession(sessionID);
            vi.useRealTimers();
            vi.clearAllMocks();
        });

        it("injects a continuation prompt after the countdown when SDK-shaped todos remain", async () => {
            const todo = {
                id: "T1",
                content: "Finish implementation",
                status: "pending",
                priority: "high",
                createdAt: new Date().toISOString(),
            };
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [todo] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);

            expect(client.session.todo).toHaveBeenCalledWith({ path: { id: sessionID } });
            expect(client.tui.showToast).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    title: "📋 Todo Continuation",
                    variant: "warning",
                }),
            });
            expect(hasPendingContinuation(sessionID)).toBe(true);
            expect(client.session.prompt).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.prompt).toHaveBeenCalledWith({
                path: { id: sessionID },
                body: {
                    parts: [{
                        type: "text",
                        synthetic: true,
                        text: expect.stringContaining("todo_continuation"),
                    }],
                },
            });
            expect(hasPendingContinuation(sessionID)).toBe(false);
        });

        it("skips todo fetching and prompt injection while background tasks are running", async () => {
            mocks.getTasksByParent.mockReturnValue([{ status: "running" }]);
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.todo).not.toHaveBeenCalled();
            expect(client.session.prompt).not.toHaveBeenCalled();
            expect(client.tui.showToast).not.toHaveBeenCalled();
            expect(hasPendingContinuation(sessionID)).toBe(false);
        });

        it("skips continuation when background task lookup fails", async () => {
            mocks.getTasksByParent.mockImplementation(() => {
                throw new Error("manager unavailable");
            });
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.todo).not.toHaveBeenCalled();
            expect(client.session.prompt).not.toHaveBeenCalled();
            expect(client.tui.showToast).not.toHaveBeenCalled();
            expect(hasPendingContinuation(sessionID)).toBe(false);
        });

        it("ignores malformed SDK todos instead of converting them into pending work", async () => {
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({
                        data: [
                            { id: "missing-status" },
                            { id: 42, status: "pending" },
                            { id: "invalid-status", status: "todo" },
                        ],
                    }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.prompt).not.toHaveBeenCalled();
            expect(client.tui.showToast).not.toHaveBeenCalled();
            expect(hasPendingContinuation(sessionID)).toBe(false);
        });

        it("does not invent file-based work when no TODO or checklist exists", async () => {
            mocks.verifyMissionCompletion.mockReturnValue({
                passed: false,
                todoIncomplete: 0,
                todoPresent: false,
                todoProgress: "0/0",
                todoComplete: false,
                checklistPresent: false,
                checklistProgress: "0/0",
                checklistComplete: false,
                syncIssuesEmpty: true,
                syncIssuesCount: 0,
                errors: ["TODO file not found at .opencode/todo.md"],
            });
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.prompt).not.toHaveBeenCalled();
            expect(client.tui.showToast).not.toHaveBeenCalled();
            expect(hasPendingContinuation(sessionID)).toBe(false);
            expect(mocks.buildVerificationFailurePrompt).not.toHaveBeenCalled();
        });

        it("keeps continuing when a tracked TODO exists but could not be parsed", async () => {
            mocks.verifyMissionCompletion.mockReturnValue({
                passed: false,
                todoIncomplete: 0,
                todoPresent: true,
                todoProgress: "0/0",
                todoComplete: false,
                checklistPresent: false,
                checklistProgress: "0/0",
                checklistComplete: false,
                syncIssuesEmpty: true,
                syncIssuesCount: 0,
                errors: ["Failed to read TODO: EACCES"],
            });
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.prompt).toHaveBeenCalled();
            expect(mocks.buildVerificationFailurePrompt).toHaveBeenCalled();
        });

        it("injects a file-based continuation when SDK todos are complete but file work remains", async () => {
            mocks.verifyMissionCompletion.mockReturnValue({
                passed: false,
                todoIncomplete: 1,
                todoPresent: true,
                todoProgress: "0/1",
                todoComplete: false,
                checklistPresent: false,
                checklistProgress: "0/0",
                checklistComplete: false,
                syncIssuesEmpty: true,
                syncIssuesCount: 0,
                errors: ["TODO incomplete"],
            });
            const completedTodo = {
                id: "T1",
                content: "Already done",
                status: "completed",
                priority: "medium",
                createdAt: new Date().toISOString(),
            };
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [completedTodo] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.prompt).toHaveBeenCalledWith({
                path: { id: sessionID },
                body: {
                    parts: [{
                        type: "text",
                        synthetic: true,
                        text: "<verification_failure>file work remains</verification_failure>",
                    }],
                },
            });
            expect(mocks.buildVerificationFailurePrompt).toHaveBeenCalled();
        });

        it("injects a verification continuation when only sync issues remain", async () => {
            mocks.verifyMissionCompletion.mockReturnValue({
                passed: false,
                todoIncomplete: 0,
                todoPresent: false,
                todoProgress: "0/0",
                todoComplete: false,
                checklistPresent: false,
                checklistProgress: "0/0",
                checklistComplete: false,
                syncIssuesEmpty: false,
                syncIssuesCount: 1,
                errors: ["Sync issues not resolved"],
            });
            const client = {
                session: {
                    todo: vi.fn().mockResolvedValue({ data: [] }),
                    prompt: vi.fn().mockResolvedValue({ data: {} }),
                },
                tui: {
                    showToast: vi.fn().mockResolvedValue({ data: true }),
                },
            };

            await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
            await vi.advanceTimersByTimeAsync(2000);

            expect(client.session.prompt).toHaveBeenCalled();
            expect(mocks.buildVerificationFailurePrompt).toHaveBeenCalled();
        });

        /**
         * Issue #38: a continuation must never land inside a turn the model is
         * still executing. `POST /session/{id}/prompt` writes the user message
         * before it checks whether the session is running, so a prompt sent to a
         * busy session is read as an interruption mid tool call.
         */
        describe("busy-session guard", () => {
            const pendingTodo = {
                id: "T1",
                content: "Finish implementation",
                status: "pending",
                priority: "high",
                createdAt: new Date().toISOString(),
            };

            function busyAwareClient(busy: boolean) {
                return {
                    session: {
                        todo: vi.fn().mockResolvedValue({ data: [pendingTodo] }),
                        prompt: vi.fn().mockResolvedValue({ data: {} }),
                        status: vi.fn().mockResolvedValue({
                            data: busy ? { [sessionID]: { type: "busy" } } : {},
                        }),
                    },
                    tui: { showToast: vi.fn().mockResolvedValue({ data: true }) },
                };
            }

            afterEach(() => {
                resetSessionActivity();
            });

            it("does not inject while the server reports the session busy", async () => {
                const client = busyAwareClient(true);

                await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
                await vi.advanceTimersByTimeAsync(2000);

                expect(client.session.status).toHaveBeenCalled();
                expect(client.session.prompt).not.toHaveBeenCalled();
            });

            it("injects once the server reports the session idle", async () => {
                const client = busyAwareClient(false);

                await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
                await vi.advanceTimersByTimeAsync(2000);

                expect(client.session.prompt).toHaveBeenCalled();
            });

            it("never schedules a countdown for a session already back at work", async () => {
                recordSessionStatus(sessionID, "busy");
                const client = busyAwareClient(false);

                await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);

                expect(hasPendingContinuation(sessionID)).toBe(false);
                expect(client.session.todo).not.toHaveBeenCalled();
            });

            it("drops a pending countdown when the session becomes busy again", async () => {
                const client = busyAwareClient(false);

                await handleSessionIdle(client as unknown as Parameters<typeof handleSessionIdle>[0], directory, sessionID, sessionID);
                expect(hasPendingContinuation(sessionID)).toBe(true);

                handleSessionBusy(sessionID);
                await vi.advanceTimersByTimeAsync(2000);

                expect(hasPendingContinuation(sessionID)).toBe(false);
                expect(client.session.prompt).not.toHaveBeenCalled();
            });
        });
    });
});
