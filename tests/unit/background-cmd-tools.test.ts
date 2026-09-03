import { describe, it, expect, vi, beforeEach } from "vitest";
import { runBackgroundTool } from "../../src/tools/background-cmd/run.js";
import { checkBackgroundTool } from "../../src/tools/background-cmd/check.js";
import { listBackgroundTool } from "../../src/tools/background-cmd/list.js";
import { killBackgroundTool } from "../../src/tools/background-cmd/kill.js";
import { backgroundTaskManager } from "../../src/core/commands/index.js";
import { BACKGROUND_STATUS, STATUS_LABEL, FILTER_STATUS } from "../../src/shared/index.js";

describe("Background Command Tools", () => {
    beforeEach(() => {
        // Clear tasks in backgroundTaskManager
        const all = backgroundTaskManager.getAll();
        for (const t of all) {
            backgroundTaskManager.kill(t.id);
        }
        // Reset internal map
        (backgroundTaskManager as any).tasks = new Map();
    });

    describe("runBackgroundTool", () => {
        it("starts a background task and returns formatted markdown", async () => {
            const spy = vi.spyOn(backgroundTaskManager, "run").mockReturnValue({
                id: "bg_123",
                command: "echo hello",
                cwd: "/tmp",
                startTime: Date.now(),
                status: BACKGROUND_STATUS.RUNNING,
                output: "",
                errorOutput: "",
                exitCode: null,
                label: "test-build",
            } as any);

            const result = await (runBackgroundTool as any).execute({
                command: "echo hello",
                cwd: "/tmp",
                timeout: 5000,
                label: "test-build",
            });

            expect(result).toContain("Background Task Started");
            expect(result).toContain("bg_123");
            expect(result).toContain("echo hello");
            expect(result).toContain("check_background({ taskId: \"bg_123\" })");

            spy.mockRestore();
        });
    });

    describe("checkBackgroundTool", () => {
        it("handles task not found when no tasks exist", async () => {
            const result = await (checkBackgroundTool as any).execute({ taskId: "nonexistent" });
            expect(result).toContain("No background tasks exist");
        });

        it("handles task not found when other tasks exist", async () => {
            (backgroundTaskManager as any).tasks.set("other_1", {
                id: "other_1",
                command: "sleep 10",
            });

            const result = await (checkBackgroundTool as any).execute({ taskId: "nonexistent" });
            expect(result).toContain("Task `nonexistent` not found");
            expect(result).toContain("other_1");
        });

        it("reports ongoing running task with stdout/stderr", async () => {
            (backgroundTaskManager as any).tasks.set("t_running", {
                id: "t_running",
                command: "npm test",
                status: STATUS_LABEL.RUNNING,
                startTime: Date.now() - 3000,
                output: "line 1\nline 2\nline 3\n",
                errorOutput: "warning line\n",
                exitCode: null,
                label: "unit-tests",
            });

            const result = await (checkBackgroundTool as any).execute({ taskId: "t_running", tailLines: 2 });
            expect(result).toContain("**Task t_running** (unit-tests)");
            expect(result).toContain("RUNNING");
            expect(result).toContain("warning line");
            expect(result).toContain("Still running... check again.");
        });

        it("truncates output when exceeding max length", async () => {
            const longOutput = "a".repeat(12000);
            (backgroundTaskManager as any).tasks.set("t_long", {
                id: "t_long",
                command: "cat bigfile",
                status: STATUS_LABEL.DONE,
                startTime: Date.now() - 5000,
                endTime: Date.now(),
                output: longOutput,
                errorOutput: longOutput,
                exitCode: 0,
            });

            const result = await (checkBackgroundTool as any).execute({ taskId: "t_long" });
            expect(result).toContain("[...truncated...]");
        });
    });

    describe("listBackgroundTool", () => {
        it("returns notice when no background tasks exist", async () => {
            const result = await (listBackgroundTool as any).execute({});
            expect(result).toContain("No background tasks");
        });

        it("lists and filters background tasks by status", async () => {
            (backgroundTaskManager as any).tasks.set("t1", {
                id: "t1",
                command: "cargo build",
                status: BACKGROUND_STATUS.RUNNING,
                startTime: 100,
            });
            (backgroundTaskManager as any).tasks.set("t2", {
                id: "t2",
                command: "cargo test",
                status: BACKGROUND_STATUS.DONE,
                startTime: 200,
            });

            const allResult = await (listBackgroundTool as any).execute({ status: FILTER_STATUS.ALL });
            expect(allResult).toContain("Background Tasks (2)");
            expect(allResult).toContain("t1");
            expect(allResult).toContain("t2");

            const runningResult = await (listBackgroundTool as any).execute({ status: BACKGROUND_STATUS.RUNNING });
            expect(runningResult).toContain("Background Tasks (1)");
            expect(runningResult).toContain("t1");
            expect(runningResult).not.toContain("t2");
        });
    });

    describe("killBackgroundTool", () => {
        it("returns not found if task doesn't exist", async () => {
            const result = await (killBackgroundTool as any).execute({ taskId: "missing" });
            expect(result).toContain("not found");
        });

        it("warns if task is not running", async () => {
            (backgroundTaskManager as any).tasks.set("done_task", {
                id: "done_task",
                command: "echo 1",
                status: STATUS_LABEL.DONE,
            });

            const result = await (killBackgroundTool as any).execute({ taskId: "done_task" });
            expect(result).toContain("is not running");
        });

        it("kills running task and reports confirmation", async () => {
            (backgroundTaskManager as any).tasks.set("run_task", {
                id: "run_task",
                command: "sleep 100",
                status: STATUS_LABEL.RUNNING,
                startTime: Date.now() - 1000,
            });
            vi.spyOn(backgroundTaskManager, "kill").mockReturnValue(true);

            const result = await (killBackgroundTool as any).execute({ taskId: "run_task" });
            expect(result).toContain("killed");
            expect(result).toContain("sleep 100");
        });

        it("handles failure to kill running task", async () => {
            (backgroundTaskManager as any).tasks.set("run_task2", {
                id: "run_task2",
                command: "sleep 100",
                status: STATUS_LABEL.RUNNING,
                startTime: Date.now() - 1000,
            });
            vi.spyOn(backgroundTaskManager, "kill").mockReturnValue(false);

            const result = await (killBackgroundTool as any).execute({ taskId: "run_task2" });
            expect(result).toContain("Could not kill task");
        });
    });
});
