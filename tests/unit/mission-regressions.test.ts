/**
 * Mission verification regressions.
 *
 * update_todo writes four markers: `[x]` (done), `[ ]` (pending), `[/]` (in
 * progress) and `[-]` (failed). Only `[x]` is complete; a mission whose TODO
 * still holds in-progress or failed lines must not verify as finished.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyMissionCompletion } from "../../src/core/loop/verification";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("TODO verification markers", () => {
    let directory: string;

    function writeTodo(lines: string[]): void {
        writeFileSync(join(directory, ".opencode", "todo.md"), ["# TODO", "", ...lines, ""].join("\n"));
    }

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "oco-mission-regressions-"));
        mkdirSync(join(directory, ".opencode"), { recursive: true });
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    it.each([
        ["in progress", "- [/] Wire the API"],
        ["failed", "- [-] Wire the API"],
    ])("counts a %s line as incomplete", (_label, line) => {
        writeTodo(["- [x] Write the schema", line]);

        const result = verifyMissionCompletion(directory);

        expect(result.passed).toBe(false);
        expect(result.todoComplete).toBe(false);
        expect(result.todoIncomplete).toBe(1);
        expect(result.todoProgress).toBe("1/2");
    });

    it("counts in-progress and failed lines alongside pending ones", () => {
        writeTodo(["- [x] Done", "- [ ] Pending", "- [/] Working", "- [-] Broken", "* [/] Starred working"]);

        const result = verifyMissionCompletion(directory);

        expect(result.passed).toBe(false);
        expect(result.todoIncomplete).toBe(4);
        expect(result.todoProgress).toBe("1/5");
    });

    it("passes once every line is checked", () => {
        writeTodo(["- [x] Write the schema", "- [X] Wire the API"]);

        const result = verifyMissionCompletion(directory);

        expect(result.todoComplete).toBe(true);
        expect(result.todoIncomplete).toBe(0);
        expect(result.passed).toBe(true);
    });
});
