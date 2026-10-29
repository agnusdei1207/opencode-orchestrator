import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWrite, escapeYaml, loadNoteMetadata, parseFrontmatter } from "../../src/core/knowledge/mission-note.js";

describe("mission note compatibility", () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "mission-note-compatibility-"));
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    it("preserves CRLF, scalar types, empty values and duplicate-key precedence", () => {
        const note = ["---", "# comment", "ignored", "", "count: 1", "count: 2",
            "empty:", "quoted: '42'", "enabled: true", "disabled: false", "nothing: ~",
            "nullValue: null", "tags: [alpha, 'beta', ,]", "---", "count: 99"].join("\r\n");
        expect(parseFrontmatter(note)).toEqual({ count: 2, empty: "", quoted: "42",
            enabled: true, disabled: false, nothing: null, nullValue: null, tags: ["alpha", "beta"] });
    });

    it("keeps the existing literal escape handling and incomplete-header fallback", () => {
        const literal = String.raw`a\\b\"c`;
        expect(parseFrontmatter(`---\ntitle: "${literal}"\n---`).title).toBe(literal);
        expect(parseFrontmatter("---\ntitle: incomplete")).toEqual({});
        expect(parseFrontmatter("body\n---\ntitle: later\n---")).toEqual({});
    });

    it("writes nested notes atomically and reads their metadata back", () => {
        const notePath = join(directory, "nested", "memories", "note.md");
        atomicWrite(notePath, `---\ntitle: "${escapeYaml(String.raw`Verify "C:\notes"`)}"\ncount: 3\n---\nbody`);

        expect(readFileSync(notePath, "utf8")).toContain(String.raw`title: "Verify \"C:\\notes\""`);
        expect(loadNoteMetadata(notePath)).toMatchObject({ count: 3 });
    });

    it("returns null metadata for a missing note", () => {
        expect(loadNoteMetadata(join(directory, "missing.md"))).toBeNull();
    });
});
