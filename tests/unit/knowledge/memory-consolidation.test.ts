import { describe, it, expect, beforeEach } from "vitest";
import { MemoryConsolidation } from "../../../src/core/knowledge/memory-consolidation";
import { TagIndexer } from "../../../src/core/knowledge/tag-indexer";
import { GraphParser } from "../../../src/core/knowledge/graph-parser";

describe("MemoryConsolidation - Knowledge Graph Maintenance Analysis", () => {
    let indexer: TagIndexer;
    let parser: GraphParser;
    let consolidation: MemoryConsolidation;

    beforeEach(() => {
        indexer = new TagIndexer();
        parser = new GraphParser();
        consolidation = new MemoryConsolidation(indexer, parser);
    });

    it("should identify notes exceeding the line count threshold", () => {
        const shortContent = "Line 1\nLine 2\nLine 3";
        const longContent = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join("\n");

        const contentMap = new Map<string, string>();
        contentMap.set("short-note", shortContent);
        contentMap.set("long-note", longContent);

        // Default threshold is 500, so neither should be oversized
        expect(consolidation.identifyOversizedNotes(contentMap)).toEqual([]);

        // With a threshold of 10, the long note should be flagged
        const oversized = consolidation.identifyOversizedNotes(contentMap, 10);
        expect(oversized).toEqual(["long-note"]);
    });

    it("should identify orphan notes with zero links in both directions", () => {
        parser.indexFile("docs/Connected.md", "Links to [[Other]]");
        parser.indexFile("docs/Other.md", "Links back [[Connected]]");
        // Orphan note has no links and no one links to it
        parser.indexFile("docs/Orphan.md", "Just some text without links.");

        const orphans = consolidation.identifyOrphanNotes(["Connected", "Other", "Orphan"]);
        expect(orphans).toEqual(["Orphan"]);
    });

    it("should return empty orphan list when all notes are connected", () => {
        parser.indexFile("docs/A.md", "[[B]]");
        parser.indexFile("docs/B.md", "[[A]]");

        const orphans = consolidation.identifyOrphanNotes(["A", "B"]);
        expect(orphans).toEqual([]);
    });

    it("should suggest merge pairs for notes sharing enough tags", () => {
        indexer.indexFile("docs/note-a.md", "---\ntags: [agent, planning, typescript, design]\n---");
        indexer.indexFile("docs/note-b.md", "---\ntags: [agent, planning, typescript, review]\n---");
        indexer.indexFile("docs/note-c.md", "---\ntags: [database, sql]\n---");

        // Default threshold is 3 — note-a and note-b share 3 tags
        const merges = consolidation.suggestMerges();
        expect(merges.length).toBe(1);
        expect(merges[0]).toEqual(["note-a", "note-b"]);
    });

    it("should respect custom merge threshold", () => {
        indexer.indexFile("docs/x.md", "---\ntags: [a, b, c, d]\n---");
        indexer.indexFile("docs/y.md", "---\ntags: [a, b, e, f]\n---");

        // With threshold 2, they share [a, b] = 2 tags — should match
        expect(consolidation.suggestMerges(2).length).toBe(1);
        // With threshold 3, they only share 2 — should not match
        expect(consolidation.suggestMerges(3).length).toBe(0);
    });

    it("should generate a MOC markdown for a given tag", () => {
        indexer.indexFile("docs/alpha.md", "---\ntags: [project]\n---");
        indexer.indexFile("docs/beta.md", "---\ntags: [project]\n---");
        indexer.indexFile("docs/gamma.md", "---\ntags: [other]\n---");

        parser.indexFile("docs/alpha.md", "");
        parser.indexFile("docs/beta.md", "");

        const moc = consolidation.generateMOC("project");
        expect(moc).toContain("# MOC: project");
        expect(moc).toContain("- [[alpha]]");
        expect(moc).toContain("- [[beta]]");
        expect(moc).not.toContain("gamma");
    });

    it("should generate a MOC with empty message when no notes match the tag", () => {
        const moc = consolidation.generateMOC("nonexistent");
        expect(moc).toContain("# MOC: nonexistent");
        expect(moc).toContain("*(No notes found with this tag)*");
    });

    it("should return oversized notes sorted alphabetically", () => {
        const content = Array.from({ length: 15 }, (_, i) => `Line ${i}`).join("\n");
        const contentMap = new Map<string, string>();
        contentMap.set("zebra", content);
        contentMap.set("alpha", content);

        const oversized = consolidation.identifyOversizedNotes(contentMap, 5);
        expect(oversized).toEqual(["alpha", "zebra"]);
    });
});
