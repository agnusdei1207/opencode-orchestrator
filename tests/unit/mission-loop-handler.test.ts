/**
 * Mission Loop Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleMissionIdle, cleanupSession } from "../../src/core/loop/mission-loop-handler.js";
import * as lockModule from "../../src/core/loop/continuation-lock.js";
import { verifyMissionCompletionAsync } from "../../src/core/loop/verification.js";
import { readLoopState } from "../../src/core/loop/mission-loop.js";

// Mock dependencies
vi.mock("../../src/core/agents/logger.js", () => ({
    log: vi.fn(),
}));

vi.mock("../../src/core/loop/verification.js", () => ({
    verifyMissionCompletion: vi.fn(), // legacy
    verifyMissionCompletionAsync: vi.fn().mockResolvedValue({ passed: false, todoProgress: "1/5" }),
    buildVerificationSummary: vi.fn().mockReturnValue("Summary"),
    buildVerificationFailurePrompt: vi.fn(),
}));

vi.mock("../../src/core/loop/mission-loop.js", () => ({
    readLoopState: vi.fn(),
    writeLoopState: vi.fn().mockReturnValue(true),
    incrementIteration: vi.fn().mockReturnValue({ iteration: 2, maxIterations: 5, prompt: "test mission" }),
    generateMissionContinuationPrompt: vi.fn().mockReturnValue("Continue mission"),
    clearLoopState: vi.fn(),
}));

vi.mock("../../src/core/loop/todo-continuation.js", () => ({
    hasPendingContinuation: vi.fn().mockReturnValue(false),
}));

vi.mock("../../src/core/recovery/session-recovery.js", () => ({
    isSessionRecovering: vi.fn().mockReturnValue(false),
}));

vi.mock("../../src/core/agents/manager.js", () => ({
    ParallelAgentManager: {
        getInstance: () => ({
            getTasksByParent: () => [],
        }),
    },
}));

vi.mock("../../src/notification/os-notify/platform.js", () => ({
    detectPlatform: vi.fn().mockReturnValue("mac"),
    getDefaultSoundPath: vi.fn(),
}));

describe("MissionLoopHandler", () => {
    const sessionID = "test-session-mission";
    const directory = "/test/dir";
    let mockClient: any;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(global, 'setTimeout');

        // Spy on lock
        vi.spyOn(lockModule, 'tryAcquireContinuationLock').mockReturnValue(true);
        vi.spyOn(lockModule, 'releaseContinuationLock').mockImplementation(() => { });

        mockClient = {
            session: {
                prompt: vi.fn().mockResolvedValue({}),
            },
            tui: {
                showToast: vi.fn(),
            }
        };

        // Setup active loop
        vi.mocked(readLoopState).mockReturnValue({
            active: true,
            sessionID: sessionID,
            iteration: 1,
            maxIterations: 5,
            prompt: "task",
            startedAt: new Date().toISOString()
        });
    });

    afterEach(() => {
        cleanupSession(sessionID);
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("should start countdown when mission is incomplete", async () => {
        await handleMissionIdle(mockClient, directory, sessionID);

        // Should use async verification
        expect(verifyMissionCompletionAsync).toHaveBeenCalled();

        // Wait for timer to be set? handled synchronously in this flow
        expect(setTimeout).toHaveBeenCalled();
    });

    it("should acquire lock before injecting continuation", async () => {
        await handleMissionIdle(mockClient, directory, sessionID);

        // Fast-forward timer (5s default)
        vi.advanceTimersByTime(11000);

        // Wait for async operations
        for (let i = 0; i < 20; i++) {
            await Promise.resolve();
        }

        // Should try to acquire lock
        expect(lockModule.tryAcquireContinuationLock).toHaveBeenCalledWith(sessionID, "mission-loop");

        // Should inject prompt
        expect(mockClient.session.prompt).toHaveBeenCalledWith(expect.objectContaining({
            body: expect.objectContaining({
                parts: expect.arrayContaining([
                    expect.objectContaining({ text: expect.stringContaining("Continue mission") })
                ])
            })
        }));

        // Should release lock
        expect(lockModule.releaseContinuationLock).toHaveBeenCalledWith(sessionID);
    });

    it("should not inject if completion passes", async () => {
        vi.mocked(verifyMissionCompletionAsync).mockResolvedValue({ passed: true } as any);

        await handleMissionIdle(mockClient, directory, sessionID);

        // Should NOT start countdown
        expect(setTimeout).not.toHaveBeenCalled();
    });
});
