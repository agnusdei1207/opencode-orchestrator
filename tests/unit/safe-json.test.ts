import { describe, expect, it } from "vitest";
import { safeJsonParse } from "../../src/utils/parsing/safe-json.js";

describe("safeJsonParse", () => {
    it("parses well-formed JSON", () => {
        expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    it("strips markdown code fences", () => {
        expect(safeJsonParse('```json\n{"ok":true}\n```')).toEqual({ ok: true });
        expect(safeJsonParse("```\n[1,2,3]\n```")).toEqual([1, 2, 3]);
    });

    it("extracts JSON embedded in surrounding prose", () => {
        expect(safeJsonParse('Sure! Here it is: {"x":2} hope that helps')).toEqual({ x: 2 });
    });

    it("repairs trailing commas", () => {
        expect(safeJsonParse('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
        expect(safeJsonParse("[1, 2, 3, ]")).toEqual([1, 2, 3]);
    });

    it("returns fallback on unrecoverable input", () => {
        expect(safeJsonParse("not json at all")).toBeNull();
        expect(safeJsonParse("", { def: true })).toEqual({ def: true });
        expect(safeJsonParse(undefined, null)).toBeNull();
    });
});
