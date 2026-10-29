
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

// Mocking the logger
vi.mock("../../src/shared/logger", () => ({
    log: vi.fn(),
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

import { handleMissionIdle, handleSessionCompacted, cleanupSession } from "../../src/core/loop/mission-loop-handler";
import { startMissionLoop, readLoopState } from "../../src/core/loop/mission-loop";
import { CHECKLIST } from "../../src/shared";

const noTasks = { hasBusyChildren: () => false };

function createClient() {
    return {
        statuses: vi.fn(() => new Map<string, string>()),
        messages: vi.fn().mockResolvedValue([]),
        prompt: vi.fn().mockResolvedValue(undefined),
    } as any;
}

describe("Mission Loop Persistence E2E", () => {
    let testDir: string;
    const testSessionID = "persistence_session_123";

    beforeEach(() => {
        vi.useFakeTimers();
        cleanupSession(testSessionID);
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
        // 1. Start a mission loop
        startMissionLoop(testDir, testSessionID, "Test persistence");

        // 2. Create an incomplete todo file
        const todoPath = path.join(testDir, ".opencode", "todo.md");
        fs.writeFileSync(todoPath, "- [ ] Incomplete task\n", "utf-8");

        // Mock host client
        const mockClient = createClient();

        // 3. Trigger idle event
        await handleMissionIdle({ client: mockClient, directory: testDir, tasks: noTasks }, testSessionID);

        // Advance timers to trigger injectContinuation
        vi.runAllTimers();

        // 4. Verify that it DID NOT clear loop state because verification failed
        const state = readLoopState(testDir);
        expect(state).not.toBeNull();
        expect(state?.active).toBe(true);

        // 5. Verify that it tried to inject a prompt (forced restart)
        // Wait for any async calls inside the timeout
        await vi.runAllTimersAsync();

        expect(mockClient.prompt).toHaveBeenCalled();
        expect(mockClient.prompt.mock.calls[0][0]).toMatchObject({ sessionID: testSessionID });
        const promptCall = mockClient.prompt.mock.calls[0][0];
        expect(promptCall.text).toContain("MISSION NOT COMPLETE");
        expect(promptCall.text).toContain("Runtime status:");
        expect(promptCall.text).toContain("continuation reason: verification_failed");
        expect(promptCall.text).toContain("Completion rule:");
    });

    it("should skip stale scheduled continuation after compaction but allow a later reschedule", async () => {
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
        startMissionLoop(testDir, testSessionID, "Test compaction reschedule");
        fs.writeFileSync(path.join(testDir, ".opencode", "todo.md"), "- [ ] Incomplete task\n", "utf-8");

        const mockClient = createClient();

        await handleMissionIdle({ client: mockClient, directory: testDir, tasks: noTasks }, testSessionID);
        handleSessionCompacted(testSessionID);

        await vi.runAllTimersAsync();
        expect(mockClient.prompt).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(3100);
        await handleMissionIdle({ client: mockClient, directory: testDir, tasks: noTasks }, testSessionID);
        await vi.runAllTimersAsync();

        expect(mockClient.prompt).toHaveBeenCalledTimes(1);
    });

    it("should persist checklist progress when todo progress is empty", async () => {
        startMissionLoop(testDir, testSessionID, "Test checklist progress");
        fs.writeFileSync(
            path.join(testDir, CHECKLIST.FILE),
            [
                "# Verification Checklist",
                "## Build Verification",
                "- [x] Build passed",
                "- [ ] Tests passed",
                "",
            ].join("\n"),
            "utf-8",
        );

        const mockClient = createClient();

        await handleMissionIdle({ client: mockClient, directory: testDir, tasks: noTasks }, testSessionID);
        const state = readLoopState(testDir);

        expect(state?.lastVerificationSummary).toContain("Checklist: 1/2");

        await vi.runAllTimersAsync();
        const promptCall = mockClient.prompt.mock.calls[0][0];
        expect(promptCall.text).toContain("verification: [Verification");
        expect(promptCall.text).toContain("Checklist: 1/2");
    });

    it("should clear loop state only if verification passes", async () => {
        // 1. Start a mission loop
        startMissionLoop(testDir, testSessionID, "Test completion");

        // 2. Mock client
        const mockClient = createClient();

        // 3. NO incomplete todos, and must have at least one complete todo to "pass"
        fs.writeFileSync(path.join(testDir, ".opencode", "todo.md"), "- [x] Done item\n", "utf-8");
        // Ensure no sync issues
        if (fs.existsSync(path.join(testDir, ".opencode", "sync-issues.md"))) {
            fs.unlinkSync(path.join(testDir, ".opencode", "sync-issues.md"));
        }

        // 4. Trigger idle event
        await handleMissionIdle({ client: mockClient, directory: testDir, tasks: noTasks }, testSessionID);

        // 5. Verify that it CLEARED loop state because verification passed
        const state = readLoopState(testDir);
        expect(state).toBeNull();
    });
});
