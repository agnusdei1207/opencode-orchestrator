/**
 * Background Task E2E Tests
 *
 * Tests for background command execution:
 * - Task creation with unique ID
 * - Status tracking
 * - Output capture
 * - Task retrieval
 * - Kill functionality
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { backgroundTaskManager } from "../../src/core/commands/index";

// Polling instead of fixed sleeps keeps these tests independent of machine
// load; the ceilings only bound a genuinely stuck process.
const EXIT_WAIT_TIMEOUT_MS = 10_000;
const EXIT_POLL_INTERVAL_MS = 20;

const createdTaskIds: string[] = [];

afterEach(async () => {
    // Cleanup: kill any running tasks
    for (const id of createdTaskIds) {
        await backgroundTaskManager.kill(id);
    }
    createdTaskIds.length = 0;
    backgroundTaskManager.clearCompleted();
});

function start(command: string, label?: string) {
    const task = backgroundTaskManager.run({ command, cwd: process.cwd(), label });
    createdTaskIds.push(task.id);
    return task;
}

async function waitForExit(taskId: string): Promise<void> {
    await vi.waitFor(() => {
        const task = backgroundTaskManager.get(taskId);
        expect(task?.process).toBeUndefined();
        expect(task?.endTime).toBeDefined();
    }, { timeout: EXIT_WAIT_TIMEOUT_MS, interval: EXIT_POLL_INTERVAL_MS });
}

describe("BackgroundTaskManager E2E task creation", () => {
    it("should create task with unique ID starting with job_", () => {
        const task = start("echo hello");

        expect(task.id).toMatch(/^job_[a-f0-9]+$/);
        expect(task.command).toBe("echo hello");
    });

    it("should set initial status to running", () => {
        expect(start("echo test").status).toBe("running");
    });

    it("should track start time", () => {
        const before = Date.now();
        const task = start("echo test");
        const after = Date.now();

        expect(task.startTime).toBeGreaterThanOrEqual(before);
        expect(task.startTime).toBeLessThanOrEqual(after);
    });

    it("should set label when provided", () => {
        expect(start("echo test", "Test Label").label).toBe("Test Label");
    });
});

describe("BackgroundTaskManager E2E task retrieval", () => {
    it("should get task by ID", () => {
        const task = start("echo test");
        expect(backgroundTaskManager.get(task.id)).toBe(task);
    });

    it("should return undefined for unknown ID", () => {
        expect(backgroundTaskManager.get("job_nonexistent")).toBeUndefined();
    });

    it("should get all tasks", () => {
        const task1 = start("echo 1");
        const task2 = start("echo 2");

        const all = backgroundTaskManager.getAll();
        expect(all.length).toBeGreaterThanOrEqual(2);
        expect(all.some(t => t.id === task1.id)).toBe(true);
        expect(all.some(t => t.id === task2.id)).toBe(true);
    });
});

describe("BackgroundTaskManager E2E status tracking", () => {
    it("should complete task with exit code 0 as done", async () => {
        const task = start("echo done");
        await waitForExit(task.id);

        const updated = backgroundTaskManager.get(task.id);
        expect(updated?.status).toBe("done");
        expect(updated?.exitCode).toBe(0);
    });

    it("should mark task as error on non-zero exit", async () => {
        const task = start("exit 1");
        await waitForExit(task.id);

        const updated = backgroundTaskManager.get(task.id);
        expect(updated?.status).toBe("error");
        expect(updated?.exitCode).toBe(1);
    });
});

describe("BackgroundTaskManager E2E output capture", () => {
    it("should capture stdout", async () => {
        const task = start('echo "hello world"');
        await waitForExit(task.id);

        expect(backgroundTaskManager.get(task.id)?.output).toContain("hello world");
    });

    it("should capture stderr", async () => {
        const task = start('echo "error message" >&2');
        await waitForExit(task.id);

        expect(backgroundTaskManager.get(task.id)?.errorOutput).toContain("error message");
    });
});

describe("BackgroundTaskManager E2E kill functionality", () => {
    it("should kill running task", async () => {
        const task = start("sleep 10");

        expect(await backgroundTaskManager.kill(task.id)).toBe(true);
        expect(backgroundTaskManager.get(task.id)?.status).toBe("error");
    });

    it("should preserve killed status after process close", async () => {
        const task = start("sleep 10");

        expect(await backgroundTaskManager.kill(task.id)).toBe(true);
        await waitForExit(task.id);

        const updated = backgroundTaskManager.get(task.id);
        expect(updated?.status).toBe("error");
        expect(updated?.errorOutput).toContain("Killed by user");
        expect(updated?.timeoutHandle).toBeUndefined();
        expect(updated?.process).toBeUndefined();
    });

    it("should return false for unknown task", async () => {
        expect(await backgroundTaskManager.kill("job_unknown")).toBe(false);
    });
});

describe("BackgroundTaskManager E2E duration formatting", () => {
    it("should format duration", async () => {
        const task = start("echo test");
        await waitForExit(task.id);

        expect(backgroundTaskManager.formatDuration(task)).toMatch(/^\d+(\.\d+)?s$/);
    });
});

describe("BackgroundTaskManager E2E status emoji", () => {
    it("should return correct emoji for each status", () => {
        // These match the actual implementation in getStatusIndicator
        expect(backgroundTaskManager.getStatusEmoji("running")).toBe("[R]");
        expect(backgroundTaskManager.getStatusEmoji("done")).toBe("[D]");
        expect(backgroundTaskManager.getStatusEmoji("error")).toBe("[-]");
        expect(backgroundTaskManager.getStatusEmoji("timeout")).toBe("[?]"); // Unknown status labels return [?]
    });
});
