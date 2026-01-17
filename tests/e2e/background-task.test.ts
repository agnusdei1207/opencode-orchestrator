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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { backgroundTaskManager } from "../../src/core/commands/index";

describe("BackgroundTaskManager E2E", () => {
    const createdTaskIds: string[] = [];

    afterEach(() => {
        // Cleanup: kill any running tasks
        for (const id of createdTaskIds) {
            backgroundTaskManager.kill(id);
        }
        createdTaskIds.length = 0;
        backgroundTaskManager.clearCompleted();
    });

    // ========================================================================
    // Task Creation
    // ========================================================================

    describe("task creation", () => {
        it("should create task with unique ID starting with job_", () => {
            const task = backgroundTaskManager.run({
                command: "echo hello",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            expect(task.id).toMatch(/^job_[a-f0-9]+$/);
            expect(task.command).toBe("echo hello");
        });

        it("should set initial status to running", () => {
            const task = backgroundTaskManager.run({
                command: "echo test",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            expect(task.status).toBe("running");
        });

        it("should track start time", () => {
            const before = Date.now();
            const task = backgroundTaskManager.run({
                command: "echo test",
                cwd: process.cwd(),
            });
            const after = Date.now();
            createdTaskIds.push(task.id);

            expect(task.startTime).toBeGreaterThanOrEqual(before);
            expect(task.startTime).toBeLessThanOrEqual(after);
        });

        it("should set label when provided", () => {
            const task = backgroundTaskManager.run({
                command: "echo test",
                cwd: process.cwd(),
                label: "Test Label",
            });
            createdTaskIds.push(task.id);

            expect(task.label).toBe("Test Label");
        });
    });

    // ========================================================================
    // Task Retrieval
    // ========================================================================

    describe("task retrieval", () => {
        it("should get task by ID", () => {
            const task = backgroundTaskManager.run({
                command: "echo test",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            const retrieved = backgroundTaskManager.get(task.id);
            expect(retrieved).toBe(task);
        });

        it("should return undefined for unknown ID", () => {
            const result = backgroundTaskManager.get("job_nonexistent");
            expect(result).toBeUndefined();
        });

        it("should get all tasks", () => {
            const task1 = backgroundTaskManager.run({ command: "echo 1", cwd: process.cwd() });
            const task2 = backgroundTaskManager.run({ command: "echo 2", cwd: process.cwd() });
            createdTaskIds.push(task1.id, task2.id);

            const all = backgroundTaskManager.getAll();
            expect(all.length).toBeGreaterThanOrEqual(2);
            expect(all.some(t => t.id === task1.id)).toBe(true);
            expect(all.some(t => t.id === task2.id)).toBe(true);
        });
    });

    // ========================================================================
    // Status Tracking
    // ========================================================================

    describe("status tracking", () => {
        it("should complete task with exit code 0 as done", async () => {
            const task = backgroundTaskManager.run({
                command: "echo done",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, 500));

            const updated = backgroundTaskManager.get(task.id);
            expect(updated?.status).toBe("done");
            expect(updated?.exitCode).toBe(0);
        });

        it("should mark task as error on non-zero exit", async () => {
            const task = backgroundTaskManager.run({
                command: "exit 1",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            await new Promise(resolve => setTimeout(resolve, 500));

            const updated = backgroundTaskManager.get(task.id);
            expect(updated?.status).toBe("error");
            expect(updated?.exitCode).toBe(1);
        });
    });

    // ========================================================================
    // Output Capture
    // ========================================================================

    describe("output capture", () => {
        it("should capture stdout", async () => {
            const task = backgroundTaskManager.run({
                command: 'echo "hello world"',
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            await new Promise(resolve => setTimeout(resolve, 500));

            const updated = backgroundTaskManager.get(task.id);
            expect(updated?.output).toContain("hello world");
        });

        it("should capture stderr", async () => {
            const task = backgroundTaskManager.run({
                command: 'echo "error message" >&2',
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            await new Promise(resolve => setTimeout(resolve, 500));

            const updated = backgroundTaskManager.get(task.id);
            expect(updated?.errorOutput).toContain("error message");
        });
    });

    // ========================================================================
    // Kill Functionality
    // ========================================================================

    describe("kill functionality", () => {
        it("should kill running task", async () => {
            const task = backgroundTaskManager.run({
                command: "sleep 10",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            // Give it time to start
            await new Promise(resolve => setTimeout(resolve, 100));

            const killed = backgroundTaskManager.kill(task.id);
            expect(killed).toBe(true);

            const updated = backgroundTaskManager.get(task.id);
            expect(updated?.status).toBe("error");
        });

        it("should return false for unknown task", () => {
            const killed = backgroundTaskManager.kill("job_unknown");
            expect(killed).toBe(false);
        });
    });

    // ========================================================================
    // Duration Formatting
    // ========================================================================

    describe("duration formatting", () => {
        it("should format duration", async () => {
            const task = backgroundTaskManager.run({
                command: "echo test",
                cwd: process.cwd(),
            });
            createdTaskIds.push(task.id);

            await new Promise(resolve => setTimeout(resolve, 100));

            const duration = backgroundTaskManager.formatDuration(task);
            expect(duration).toMatch(/^\d+(\.\d+)?s$/);
        });
    });

    // ========================================================================
    // Status Emoji
    // ========================================================================

    describe("status emoji", () => {
        it("should return correct emoji for each status", () => {
            // These match the actual implementation in constants.ts
            expect(backgroundTaskManager.getStatusEmoji("running")).toBe("RUN");
            expect(backgroundTaskManager.getStatusEmoji("done")).toBe("OK");
            expect(backgroundTaskManager.getStatusEmoji("error")).toBe("ERR");
            expect(backgroundTaskManager.getStatusEmoji("timeout")).toBe("TIM");
        });
    });
});
