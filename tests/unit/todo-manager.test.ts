/**
 * TodoManager: incremental, serialized, atomic edits to .opencode/todo.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TodoManager } from "../../src/core/todo/todo-manager.js";
import * as missionNote from "../../src/core/knowledge/mission-note.js";

vi.mock("../../src/core/knowledge/mission-note.js", async importOriginal => {
    const actual = await importOriginal<typeof import("../../src/core/knowledge/mission-note.js")>();
    return { ...actual, atomicWrite: vi.fn(actual.atomicWrite) };
});

let testDir: string;
let todoPath: string;

beforeEach(() => {
    vi.mocked(missionNote.atomicWrite).mockClear();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-"));
    todoPath = path.join(testDir, ".opencode", "todo.md");
    fs.mkdirSync(path.dirname(todoPath), { recursive: true });
    fs.writeFileSync(todoPath, "# Initial TODO\n- [ ] Task 1");
});

afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
});

const readTodo = () => fs.readFileSync(todoPath, "utf8");

describe("getInstance", () => {
    it("returns one manager per resolved project directory", () => {
        const manager = TodoManager.getInstance(testDir);
        expect(TodoManager.getInstance(path.join(testDir, "."))).toBe(manager);
        expect(TodoManager.getInstance(path.join(testDir, "other"))).not.toBe(manager);
    });

    it("writes each project's TODO into its own directory", async () => {
        const otherDir = path.join(testDir, "other");
        fs.mkdirSync(path.join(otherDir, ".opencode"), { recursive: true });
        fs.writeFileSync(path.join(otherDir, ".opencode", "todo.md"), "- [ ] Task 1");

        expect(await TodoManager.getInstance(otherDir).updateItem("Task 1", "completed")).toBe(true);

        expect(fs.readFileSync(path.join(otherDir, ".opencode", "todo.md"), "utf8")).toBe("- [x] Task 1");
        expect(readTodo()).toBe("# Initial TODO\n- [ ] Task 1");
    });
});

describe("updateItem", () => {
    it.each([
        ["completed", "[x]"],
        ["progress", "[/]"],
        ["failed", "[-]"],
        ["pending", "[ ]"],
    ])("sets status %s as marker %s", async (status, marker) => {
        fs.writeFileSync(todoPath, "- [/] Task 1");
        expect(await TodoManager.getInstance(testDir).updateItem("Task 1", status)).toBe(true);
        expect(readTodo()).toBe(`- ${marker} Task 1`);
    });

    it("updates only the first matching checkbox line", async () => {
        fs.writeFileSync(todoPath, "## Task 1 notes\n- [ ] Task 1 build\n- [ ] Task 1 test");

        expect(await TodoManager.getInstance(testDir).updateItem("Task 1", "completed")).toBe(true);

        // The heading contains the text but has no checkbox, so it is skipped.
        expect(readTodo()).toBe("## Task 1 notes\n- [x] Task 1 build\n- [ ] Task 1 test");
    });

    it("updates a task whose checkbox uses an uppercase X", async () => {
        fs.writeFileSync(todoPath, "- [X] Task 1");
        expect(await TodoManager.getInstance(testDir).updateItem("Task 1", "pending")).toBe(true);
        expect(readTodo()).toBe("- [ ] Task 1");
    });

    it("returns false and leaves the file untouched when no task matches", async () => {
        expect(await TodoManager.getInstance(testDir).updateItem("Missing task", "completed")).toBe(false);
        expect(readTodo()).toBe("# Initial TODO\n- [ ] Task 1");
        expect(missionNote.atomicWrite).not.toHaveBeenCalled();
    });

    it("rejects an unknown status instead of silently marking the task pending", async () => {
        fs.writeFileSync(todoPath, "- [x] Task 1");
        const manager = TodoManager.getInstance(testDir);

        expect(() => manager.updateItem("Task 1", "done")).toThrow(/Unknown TODO status "done"/);
        expect(readTodo()).toBe("- [x] Task 1");
    });
});

describe("addSubTask", () => {
    it("inserts a pending sub-task right below the parent, indented one level deeper", async () => {
        fs.writeFileSync(todoPath, "- [ ] Parent\n    - [ ] Nested parent\n- [ ] Sibling");
        const manager = TodoManager.getInstance(testDir);

        expect(await manager.addSubTask("Parent", "Top child")).toBe(true);
        expect(await manager.addSubTask("Nested parent", "Deep child")).toBe(true);

        expect(readTodo()).toBe([
            "- [ ] Parent",
            "  - [ ] Top child",
            "    - [ ] Nested parent",
            "      - [ ] Deep child",
            "- [ ] Sibling",
        ].join("\n"));
    });

    it("returns false and does not write when the parent is missing", async () => {
        expect(await TodoManager.getInstance(testDir).addSubTask("Missing parent", "Child task")).toBe(false);
        expect(readTodo()).not.toContain("Child task");
        expect(missionNote.atomicWrite).not.toHaveBeenCalled();
    });
});

describe("blank search text", () => {
    it.each(["", "   "])("never matches every line for %j", async searchText => {
        const manager = TodoManager.getInstance(testDir);

        expect(await manager.updateItem(searchText, "completed")).toBe(false);
        expect(await manager.addSubTask(searchText, "Child task")).toBe(false);
        expect(readTodo()).toBe("# Initial TODO\n- [ ] Task 1");
    });
});

describe("missing TODO file", () => {
    it("returns false without creating the file", async () => {
        fs.rmSync(todoPath);
        const manager = TodoManager.getInstance(testDir);

        expect(await manager.updateItem("Task 1", "completed")).toBe(false);
        expect(await manager.addSubTask("Task 1", "Child")).toBe(false);
        expect(fs.existsSync(todoPath)).toBe(false);
    });

    it("does not create the .opencode directory for a fresh project", async () => {
        const freshDir = path.join(testDir, "fresh");
        expect(await TodoManager.getInstance(freshDir).updateItem("Task", "completed")).toBe(false);
        expect(fs.existsSync(path.join(freshDir, ".opencode"))).toBe(false);
    });
});

describe("serialized writes", () => {
    it("applies concurrent edits one after another without losing either change", async () => {
        fs.writeFileSync(todoPath, "- [ ] Task 1\n- [ ] Task 2");
        const manager = TodoManager.getInstance(testDir);

        const results = await Promise.all([
            manager.updateItem("Task 1", "completed"),
            manager.addSubTask("Task 2", "Child of 2"),
            manager.updateItem("Task 2", "progress"),
        ]);

        expect(results).toEqual([true, true, true]);
        expect(readTodo()).toBe("- [x] Task 1\n- [/] Task 2\n  - [ ] Child of 2");
    });

    it("keeps serving edits after one write fails", async () => {
        const manager = TodoManager.getInstance(testDir);
        vi.mocked(missionNote.atomicWrite).mockImplementationOnce(() => {
            throw new Error("disk full");
        });

        const failed = manager.updateItem("Task 1", "completed");
        const next = manager.addSubTask("Task 1", "Child");

        await expect(failed).rejects.toThrow("disk full");
        await expect(next).resolves.toBe(true);
        expect(readTodo()).toBe("# Initial TODO\n- [ ] Task 1\n  - [ ] Child");
    });

    it("replaces the file atomically and leaves no temp files", async () => {
        await TodoManager.getInstance(testDir).updateItem("Task 1", "completed");

        expect(missionNote.atomicWrite).toHaveBeenCalledWith(todoPath, "# Initial TODO\n- [x] Task 1");
        expect(fs.readdirSync(path.dirname(todoPath))).toEqual(["todo.md"]);
    });
});
