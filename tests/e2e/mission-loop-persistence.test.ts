
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

// Mocking the logger
vi.mock("../../src/core/agents/logger", () => ({
    log: (msg: string, ...args: any[]) => console.log(`[LOG] ${msg}`, ...args),
}));

// Mock shared constants to avoid issues
vi.mock("../../src/shared", async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        LOOP: {
            ...actual.LOOP,
            COUNTDOWN_SECONDS: 0.1, // Shorten for tests
        },
        MISSION_CONTROL: {
            ...actual.MISSION_CONTROL,
            DEFAULT_COUNTDOWN_SECONDS: 0.1,
        }
    };
});

// Mock verification to avoid real FS/timer races in E2E
vi.mock("../../src/core/loop/verification.js", () => ({
    verifyMissionCompletionAsync: vi.fn().mockResolvedValue({
        passed: false,
        todoIncomplete: 1,
        todoProgress: "0/1",
        checklistProgress: "0/0"
    }),
    verifyMissionCompletion: vi.fn(),
    buildVerificationFailurePrompt: vi.fn().mockReturnValue("MISSION NOT COMPLETE"),
    buildVerificationSummary: vi.fn()
}));

import { handleMissionIdle, cleanupSession } from "../../src/core/loop/mission-loop-handler";
import { startMissionLoop, readLoopState } from "../../src/core/loop/mission-loop";
import { clearAllLocks } from "../../src/core/loop/continuation-lock";
import { PATHS } from "../../src/shared";

describe("Mission Loop Persistence E2E", () => {
    let testDir: string;
    const testSessionID = "persistence_session_123";

    beforeEach(() => {
        vi.useFakeTimers();
        cleanupSession(testSessionID);
        clearAllLocks();
        testDir = path.join(tmpdir(), `mission-persistence-test-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });
        fs.mkdirSync(path.join(testDir, ".opencode"), { recursive: true });
    });

    afterEach(() => {
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
        } catch { }
    });

    it("should keep loop active and inject prompt if checklist is incomplete", async () => {
        // 1. Start a mission loop with 1 max iteration
        startMissionLoop(testDir, testSessionID, "Test persistence", { maxIterations: 1 });

        // 2. Create an incomplete todo file
        const todoPath = path.join(testDir, ".opencode", "todo.md");
        fs.writeFileSync(todoPath, "- [ ] Incomplete task\n", "utf-8");

        // Mock OpenCode client
        const mockClient = {
            session: {
                messages: vi.fn().mockResolvedValue({ data: [] }),
                prompt: vi.fn().mockImplementation((args) => {
                    console.log("[Mock] prompt called", args);
                    return Promise.resolve({});
                }),
                todo: vi.fn().mockResolvedValue({ data: [] }),
            }
        } as any;

        // 3. Trigger idle event at max iterations (iteration 1 >= max 1)
        await handleMissionIdle(mockClient, testDir, testSessionID);

        // Wait for async verification
        await vi.runAllTimersAsync();

        // Advance timers to trigger the countdown callback
        await vi.advanceTimersByTimeAsync(1000); // 100ms * 10 = 1s, enough for 0.1s countdown

        // Wait for async operations (lock + injection)
        for (let i = 0; i < 100; i++) {
            await Promise.resolve();
        }

        expect(mockClient.session.prompt).toHaveBeenCalled();
        const promptCall = mockClient.session.prompt.mock.calls[0][0];
        expect(promptCall.body.parts[0].text).toContain("MISSION NOT COMPLETE");
    });

    it("should clear loop state only if verification passes", async () => {
        // Setup passing verification
        const { verifyMissionCompletionAsync } = await import("../../src/core/loop/verification.js");
        vi.mocked(verifyMissionCompletionAsync).mockResolvedValueOnce({
            passed: true,
            todoComplete: true,
            syncIssuesEmpty: true,
            checklistProgress: "0/0"
        } as any);

        // 1. Start a mission loop
        startMissionLoop(testDir, testSessionID, "Test completion");

        // 2. Mock client
        const mockClient = {
            session: {
                messages: vi.fn().mockResolvedValue({
                    data: [{
                        info: { role: "assistant" },
                        parts: [{ type: "text", text: "Mission finished!" }]
                    }]
                }),
                prompt: vi.fn().mockResolvedValue({}),
                todo: vi.fn().mockResolvedValue({ data: [] }),
            }
        } as any;

        // 3. NO incomplete todos, and must have at least one complete todo to "pass"
        fs.writeFileSync(path.join(testDir, ".opencode", "todo.md"), "- [x] Done item\n", "utf-8");
        // Ensure no sync issues
        if (fs.existsSync(path.join(testDir, ".opencode", "sync-issues.md"))) {
            fs.unlinkSync(path.join(testDir, ".opencode", "sync-issues.md"));
        }

        // 4. Trigger idle event
        await handleMissionIdle(mockClient, testDir, testSessionID);

        // 5. Verify that it CLEARED loop state because verification passed
        const state = readLoopState(testDir);
        expect(state).toBeNull();
    });
});
