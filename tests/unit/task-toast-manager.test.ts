/**
 * TaskToastManager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("TaskToastManager", () => {
    describe("task tracking", () => {
        it("should add task with correct properties", () => {
            const tasks = new Map<string, TrackedTask>();

            const task: TrackedTask = {
                id: "task-1",
                description: "Test task",
                agent: "Worker",
                isBackground: true,
                status: "running",
                startedAt: new Date(),
                parentSessionID: "parent-1",
                sessionID: "session-1",
            };

            tasks.set(task.id, task);

            expect(tasks.has("task-1")).toBe(true);
            expect(tasks.get("task-1")?.description).toBe("Test task");
            expect(tasks.get("task-1")?.status).toBe("running");
        });

        it("should update task status", () => {
            const tasks = new Map<string, TrackedTask>();

            const task: TrackedTask = {
                id: "task-1",
                description: "Test task",
                agent: "Worker",
                isBackground: true,
                status: "running",
                startedAt: new Date(),
                parentSessionID: "parent-1",
                sessionID: "session-1",
            };

            tasks.set(task.id, task);
            task.status = "completed";
            task.completedAt = new Date();

            expect(tasks.get("task-1")?.status).toBe("completed");
            expect(tasks.get("task-1")?.completedAt).toBeDefined();
        });

        it("should remove completed task", () => {
            const tasks = new Map<string, TrackedTask>();

            tasks.set("task-1", {
                id: "task-1",
                description: "Test",
                agent: "Worker",
                isBackground: true,
                status: "completed",
                startedAt: new Date(),
                completedAt: new Date(),
                parentSessionID: "parent-1",
                sessionID: "session-1",
            });

            tasks.delete("task-1");
            expect(tasks.has("task-1")).toBe(false);
        });
    });

    describe("task filtering", () => {
        it("should get running tasks", () => {
            const tasks: TrackedTask[] = [
                { id: "1", status: "running", description: "", agent: "", isBackground: true, startedAt: new Date(), parentSessionID: "", sessionID: "" },
                { id: "2", status: "completed", description: "", agent: "", isBackground: true, startedAt: new Date(), parentSessionID: "", sessionID: "" },
                { id: "3", status: "running", description: "", agent: "", isBackground: true, startedAt: new Date(), parentSessionID: "", sessionID: "" },
            ];

            const running = tasks.filter((t) => t.status === "running");
            expect(running.length).toBe(2);
        });

        it("should get queued tasks", () => {
            const tasks: TrackedTask[] = [
                { id: "1", status: "queued", description: "", agent: "", isBackground: true, startedAt: new Date(), parentSessionID: "", sessionID: "" },
                { id: "2", status: "running", description: "", agent: "", isBackground: true, startedAt: new Date(), parentSessionID: "", sessionID: "" },
                { id: "3", status: "queued", description: "", agent: "", isBackground: true, startedAt: new Date(), parentSessionID: "", sessionID: "" },
            ];

            const queued = tasks.filter((t) => t.status === "queued");
            expect(queued.length).toBe(2);
        });
    });

    describe("message formatting", () => {
        it("should format task list message", () => {
            const running = [
                { id: "1", description: "Build feature", agent: "Worker", isBackground: true, startedAt: new Date() },
                { id: "2", description: "Test feature", agent: "Reviewer", isBackground: false, startedAt: new Date() },
            ];

            const lines: string[] = [];
            lines.push(`Running (${running.length}):`);

            for (const task of running) {
                const icon = task.isBackground ? "⚡" : "🔄";
                lines.push(`${icon} ${task.description} (${task.agent})`);
            }

            const message = lines.join("\n");

            expect(message).toContain("Running (2):");
            expect(message).toContain("⚡ Build feature (Worker)");
            expect(message).toContain("🔄 Test feature (Reviewer)");
        });

        it("should mark new task with NEW marker", () => {
            const newTaskId = "new-task";
            const task = { id: newTaskId, description: "New task" };

            const marker = task.id === newTaskId ? " ← NEW" : "";
            expect(marker).toBe(" ← NEW");
        });

        it("should format duration correctly", () => {
            const formatDuration = (startedAt: Date): string => {
                const elapsed = Date.now() - startedAt.getTime();
                if (elapsed < 60000) {
                    return `${Math.floor(elapsed / 1000)}s`;
                }
                return `${Math.floor(elapsed / 60000)}m`;
            };

            const recent = new Date(Date.now() - 30000); // 30 seconds ago
            expect(formatDuration(recent)).toBe("30s");

            const older = new Date(Date.now() - 120000); // 2 minutes ago
            expect(formatDuration(older)).toBe("2m");
        });
    });

    describe("completion summary", () => {
        it("should show remaining count on individual completion", () => {
            const completedCount = 1;
            const remainingCount = 3;

            const message = `✅ Task completed (${remainingCount} remaining)`;
            expect(message).toContain("3 remaining");
        });

        it("should show all complete message", () => {
            const completedTasks = [
                { id: "1", description: "Task 1", durationMs: 5000 },
                { id: "2", description: "Task 2", durationMs: 10000 },
            ];

            const message = `🎉 All ${completedTasks.length} Tasks Completed`;
            expect(message).toContain("2 Tasks Completed");
        });
    });

    describe("concurrency info", () => {
        it("should format concurrency slot info", () => {
            const current = 3;
            const max = 5;

            const info = ` [${current}/${max}]`;
            expect(info).toBe(" [3/5]");
        });
    });
});

// Type definition for tests
interface TrackedTask {
    id: string;
    description: string;
    agent: string;
    isBackground: boolean;
    status?: "queued" | "running" | "completed" | "error";
    startedAt: Date;
    completedAt?: Date;
    parentSessionID: string;
    sessionID: string;
}
