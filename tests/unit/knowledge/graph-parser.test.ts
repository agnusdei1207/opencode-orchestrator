import { describe, it, expect, beforeEach } from "vitest";
import { GraphParser } from "../../../src/core/knowledge/graph-parser";

describe("GraphParser - Wiki-Links & Backlink Knowledge Graph RAG", () => {
    let parser: GraphParser;

    beforeEach(() => {
        parser = new GraphParser();
    });

    it("should successfully extract standard Wiki-Links, labels, and sections", () => {
        const content = `
            # Second Brain
            Link to [[Core-Architecture-MOC]].
            Also check [[TagIndexer-Implementation|Tag Indexer]] and [[GraphParser-Design#Phase-2]].
            Double link: [[Core-Architecture-MOC]].
        `;
        const links = parser.parseLinks(content);

        expect(links).toEqual(["Core-Architecture-MOC", "TagIndexer-Implementation", "GraphParser-Design"]);
    });

    it("should successfully extract local standard markdown links and ignore absolute URLs", () => {
        const content = `
            Check out [Release Notes](./1.2.71-Release-Notes.md).
            Refer to [Wiki-Links](wiki-links.md) and [External](https://google.com).
        `;
        const links = parser.parseLinks(content);

        expect(links).toEqual(["1.2.71-Release-Notes", "wiki-links"]);
    });

    it("should construct a correct bi-directional adjacency-list knowledge graph on indexing", () => {
        const doc1 = `
            title: MOC
            Links: [[Note-A]] and [[Note-B]].
        `;
        const doc2 = `
            title: Note A
            Links: [[Note-B]] and [Notes](./MOC.md).
        `;

        parser.indexFile("docs/MOC.md", doc1);
        parser.indexFile("docs/Note-A.md", doc2);

        // MOC links to Note-A and Note-B
        expect(parser.getForwardLinks("MOC")).toEqual(["Note-A", "Note-B"]);
        // Note-A links to Note-B and MOC
        expect(parser.getForwardLinks("Note-A")).toEqual(["MOC", "Note-B"]);

        // Backlinks to MOC: Note-A
        expect(parser.getBacklinks("MOC")).toEqual(["Note-A"]);
        // Backlinks to Note-A: MOC
        expect(parser.getBacklinks("Note-A")).toEqual(["MOC"]);
        // Backlinks to Note-B: MOC, Note-A
        expect(parser.getBacklinks("Note-B")).toEqual(["MOC", "Note-A"]);
    });

    it("should cleanly update adjacency list and remove obsolete links when re-indexed", () => {
        parser.indexFile("docs/MOC.md", "[[Note-A]] and [[Note-B]]");
        expect(parser.getBacklinks("Note-B")).toEqual(["MOC"]);

        // MOC no longer references Note-B
        parser.indexFile("docs/MOC.md", "[[Note-A]] and [[Note-C]]");
        expect(parser.getBacklinks("Note-B")).toEqual([]);
        expect(parser.getBacklinks("Note-C")).toEqual(["MOC"]);
    });

    it("should correctly sync backlinks section by appending when not present", () => {
        const initial = "# Header\nSome details here.";
        const result = parser.syncBacklinksSection(initial, ["Note-A", "Note-B"]);

        expect(result).toContain("## 🔗 Backlinks");
        expect(result).toContain("- [[Note-A]]");
        expect(result).toContain("- [[Note-B]]");
    });

    it("should correctly sync backlinks section by replacing when already present", () => {
        const initial = `# Header\nSome details here.\n\n## 🔗 Backlinks\n\n- [[Old-Note]]`;
        const result = parser.syncBacklinksSection(initial, ["New-Note"]);

        expect(result).not.toContain("- [[Old-Note]]");
        expect(result).toContain("## 🔗 Backlinks");
        expect(result).toContain("- [[New-Note]]");
    });

    it("should display a clean empty message if no backlinks are found during synchronization", () => {
        const initial = "# Header\nSome details here.";
        const result = parser.syncBacklinksSection(initial, []);

        expect(result).toContain("## 🔗 Backlinks");
        expect(result).toContain("*(No backlinks found)*");
    });
});
