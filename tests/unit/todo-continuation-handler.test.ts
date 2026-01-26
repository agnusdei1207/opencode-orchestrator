/**
 * Todo Continuation Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleSessionIdle, cleanupSession } from "../../src/core/loop/todo-continuation.js";
import * as lockModule from "../../src/core/loop/continuation-lock.js";
import { verifyMissionCompletionAsync } from "../../src/core/loop/verification.js";

// Mock dependencies
vi.mock("../../src/core/agents/logger.js", () => ({
    log: vi.fn(),
}));

vi.mock("../../src/core/loop/verification.js", () => ({
    verifyMissionCompletion: vi.fn(), // legacy
    verifyMissionCompletionAsync: vi.fn().mockResolvedValue({ passed: false, todoIncomplete: 1 }),
    buildTodoIncompletePrompt: vi.fn().mockReturnValue("mock-incomplete-prompt"),
}));

vi.mock("../../src/core/recovery/session-recovery.js", () => ({
    isSessionRecovering: vi.fn().mockReturnValue(false),
}));

vi.mock("../../src/core/loop/stats.js", () => ({
    getIncompleteCount: vi.fn().mockReturnValue(1),
    hasRemainingWork: vi.fn().mockReturnValue(true),
    getNextPending: vi.fn().mockReturnValue({ id: "1" }),
}));

vi.mock("../../src/core/loop/formatters.js", () => ({
    generateContinuationPrompt: vi.fn().mockReturnValue("mock-continuation-prompt"),
    formatProgress: vi.fn().mockReturnValue("1/2"),
}));

vi.mock("../../src/core/agents/manager.js", () => ({
    ParallelAgentManager: {
        getInstance: () => ({
            getTasksByParent: () => [],
        }),
    },
}));

describe("TodoContinuationHandler", () => {
    const sessionID = "test-session-handler";
    const directory = "/test/dir";
    let mockClient: any;

    beforeEach(() => {
        vi.useFakeTimers();

        // Spy on lock module
        vi.spyOn(lockModule, 'tryAcquireContinuationLock').mockReturnValue(true);
        vi.spyOn(lockModule, 'releaseContinuationLock').mockImplementation(() => { });
        vi.spyOn(lockModule, 'hasContinuationLock').mockReturnValue(false);

        mockClient = {
            session: {
                todo: vi.fn().mockResolvedValue({
                    data: [
                        { id: "1", status: "pending", content: "Task 1" }
                    ]
                }),
                prompt: vi.fn().mockResolvedValue({}),
            },
            tui: {
                showToast: vi.fn(),
            }
        };
    });

    afterEach(() => {
        cleanupSession(sessionID);
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("should start countdown when todos are incomplete", async () => {
        await handleSessionIdle(mockClient, directory, sessionID);

        // Should have fetched todos
        expect(mockClient.session.todo).toHaveBeenCalled();

        // Should have shown toast
        expect(mockClient.tui.showToast).toHaveBeenCalled();
    });

    it("should acquire lock before injecting continuation", async () => {
        // Setup state where fetch succeeds
        mockClient.session.todo.mockResolvedValue({
            data: [{ id: "1", status: "pending", content: "Task 1" }]
        });

        // Trigger idle
        await handleSessionIdle(mockClient, directory, sessionID);

        // Fast-forward timer (3s)
        vi.advanceTimersByTime(3000);

        // Wait for async operations in the timer callback
        for (let i = 0; i < 20; i++) {
            await Promise.resolve();
        }

        // Should try to acquire lock
        expect(lockModule.tryAcquireContinuationLock).toHaveBeenCalledWith(sessionID, "todo-continuation");

        // Should inject prompt
        expect(mockClient.session.prompt).toHaveBeenCalled();

        // Should release lock
        expect(lockModule.releaseContinuationLock).toHaveBeenCalledWith(sessionID);
    });

    it("should not inject if lock acquisition fails", async () => {
        // Mock lock failure
        vi.mocked(lockModule.tryAcquireContinuationLock).mockReturnValueOnce(false);

        await handleSessionIdle(mockClient, directory, sessionID);

        // Fast-forward timer
        vi.advanceTimersByTime(3000);
        for (let i = 0; i < 20; i++) { await Promise.resolve(); }

        // Should NOT inject
        expect(mockClient.session.prompt).not.toHaveBeenCalled();
    });
});
