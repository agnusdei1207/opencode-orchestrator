import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWrite, escapeYaml } from "../../src/core/knowledge/mission-note.js";

vi.mock("node:fs", async importOriginal => {
    const actual = await importOriginal<typeof import("node:fs")>();
    return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

describe("mission note helpers", () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "mission-note-compatibility-"));
    });

    afterEach(() => {
        vi.mocked(fs.renameSync).mockClear();
        rmSync(directory, { recursive: true, force: true });
    });

    it("escapes backslashes before quotes so YAML double-quoted values round-trip", () => {
        expect(escapeYaml(String.raw`Verify "C:\notes"`)).toBe(String.raw`Verify \"C:\\notes\"`);
        expect(escapeYaml("plain")).toBe("plain");
    });

    it("creates missing parent directories and leaves no temp file behind", () => {
        const notePath = join(directory, "nested", "memories", "note.md");
        atomicWrite(notePath, `---\ntitle: "${escapeYaml(String.raw`Verify "C:\notes"`)}"\n---\nbody`);

        expect(readFileSync(notePath, "utf8")).toContain(String.raw`title: "Verify \"C:\\notes\""`);
        expect(readdirSync(join(directory, "nested", "memories"))).toEqual(["note.md"]);
    });

    it("replaces existing content", () => {
        const notePath = join(directory, "note.md");
        writeFileSync(notePath, "old", "utf8");
        atomicWrite(notePath, "new");
        expect(readFileSync(notePath, "utf8")).toBe("new");
    });

    it("keeps the previous file and removes the temp file when the rename fails", () => {
        const notePath = join(directory, "note.md");
        writeFileSync(notePath, "old", "utf8");
        vi.mocked(fs.renameSync).mockImplementationOnce(() => {
            throw new Error("rename failed");
        });

        expect(() => atomicWrite(notePath, "new")).toThrow("rename failed");
        expect(readFileSync(notePath, "utf8")).toBe("old");
        expect(readdirSync(directory)).toEqual(["note.md"]);
    });
});
