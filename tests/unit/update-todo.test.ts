/**
 * update_todo tool: the plugin's only tool. It edits the calling session's
 * project TODO through TodoManager.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUpdateTodoTool } from "../../src/tools/update-todo.js";
import { TodoManager } from "../../src/core/todo/todo-manager.js";
import { OUTPUT_LABEL } from "../../src/shared/index.js";

type Execute = (args: Record<string, unknown>, context: { directory: string }) => Promise<string>;

describe("update_todo", () => {
    let directory: string;
    let execute: Execute;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "update-todo-"));
        execute = (createUpdateTodoTool() as unknown as { execute: Execute }).execute;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        rmSync(directory, { recursive: true, force: true });
    });

    function writeTodo(content: string): string {
        const todoPath = join(directory, ".opencode", "todo.md");
        mkdirSync(join(directory, ".opencode"), { recursive: true });
        writeFileSync(todoPath, content);
        return todoPath;
    }

    it("requires status for update action", async () => {
        const result = await execute({ action: "update", task: "Build feature" }, { directory });
        expect(result).toContain(OUTPUT_LABEL.ERROR);
        expect(result).toContain("'status' is required");
    });

    it("requires subtask for add action", async () => {
        const result = await execute({ action: "add", task: "Parent" }, { directory });
        expect(result).toContain(OUTPUT_LABEL.ERROR);
        expect(result).toContain("'subtask' is required");
    });

    it("updates the status of an existing task in the calling session's directory", async () => {
        const todoPath = writeTodo("- [ ] Build feature");

        const result = await execute({ action: "update", task: "Build feature", status: "completed" }, { directory });

        expect(result).toBe(`${OUTPUT_LABEL.DONE} Updated task status: "Build feature" -> completed`);
        expect(readFileSync(todoPath, "utf8")).toBe("- [x] Build feature");
    });

    it("reports an error when the task to update is not found", async () => {
        const todoPath = writeTodo("- [ ] Build feature");

        const result = await execute({ action: "update", task: "Nonexistent", status: "completed" }, { directory });

        expect(result).toBe(`${OUTPUT_LABEL.ERROR} Task not found: "Nonexistent"`);
        expect(readFileSync(todoPath, "utf8")).toBe("- [ ] Build feature");
    });

    it("adds a sub-task under the parent task", async () => {
        const todoPath = writeTodo("- [ ] Parent");

        const result = await execute({ action: "add", task: "Parent", subtask: "Child subtask" }, { directory });

        expect(result).toBe(`${OUTPUT_LABEL.DONE} Added sub-task: "Child subtask" under "Parent"`);
        expect(readFileSync(todoPath, "utf8")).toBe("- [ ] Parent\n  - [ ] Child subtask");
    });

    it("reports an error when the parent task is not found for add", async () => {
        writeTodo("- [ ] Parent");

        const result = await execute({ action: "add", task: "Missing", subtask: "Child subtask" }, { directory });

        expect(result).toBe(`${OUTPUT_LABEL.ERROR} Parent task not found: "Missing"`);
    });

    it("uses the manager of the directory passed by the host", async () => {
        const spy = vi.spyOn(TodoManager.getInstance(directory), "updateItem").mockResolvedValue(true);

        await execute({ action: "update", task: "Task", status: "pending" }, { directory });

        expect(spy).toHaveBeenCalledWith("Task", "pending");
    });
});
