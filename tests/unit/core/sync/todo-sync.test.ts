import { describe, it, expect } from "vitest";
import { parseTodoMd } from "../../../../src/core/sync/todo-parser.js";

describe("Todo Parser", () => {
    it("should parse pending tasks", () => {
        const input = "- [ ] Task 1\n- [ ] Task 2";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(2);
        expect(result[0].status).toBe("pending");
        expect(result[0].content).toBe("Task 1");
    });

    it("should parse completed tasks", () => {
        const input = "- [x] Done Task";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("completed");
    });

    it("should parse in-progress tasks", () => {
        const input = "- [/] MIP Task";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("in_progress");
    });

    it("should ignore non-task lines", () => {
        const input = "# Title\n- [ ] Task\nJust text";
        const result = parseTodoMd(input);
        expect(result).toHaveLength(1);
    });
});
