import { describe, it, expect, beforeEach } from "vitest";
import { TagIndexer } from "../../../src/core/knowledge/tag-indexer";

describe("TagIndexer - Frontmatter & Tag Indexing RAG Engine", () => {
    let indexer: TagIndexer;

    beforeEach(() => {
        indexer = new TagIndexer();
    });

    it("should successfully parse standard inline array tags from frontmatter", () => {
        const doc = `---\ntags: [agent, planner, brain]\ntitle: "Obsidian Mind"\n---\n# Notes Body\nSome content.`;
        const { data, body } = indexer.parseFrontmatter(doc);

        expect(data.tags).toEqual(["agent", "planner", "brain"]);
        expect(data.title).toBe("Obsidian Mind");
        expect(body).toBe("# Notes Body\nSome content.");
    });

    it("should successfully parse block-list tags from frontmatter", () => {
        const doc = `---\ntitle: Block List Test\ntags:\n  - coding\n  - rust\n  - typescript\n---\nBody text here.`;
        const { data, body } = indexer.parseFrontmatter(doc);

        expect(data.tags).toEqual(["coding", "rust", "typescript"]);
        expect(data.title).toBe("Block List Test");
        expect(body).toBe("Body text here.");
    });

    it("should parse bi-temporal memory metadata from frontmatter", () => {
        const doc = [
            "---",
            "tags: [memory, sop]",
            "event_time: 2026-06-18T00:00:00Z",
            "ingestion_time: 2026-06-19T09:00:00Z",
            "last_accessed: 2026-06-19T10:00:00Z",
            "access_count: 7",
            "importance: 0.82",
            "valid_to: null",
            "supersedes: [mem-old]",
            "---",
            "Body text here.",
        ].join("\n");

        const { data } = indexer.parseFrontmatter(doc);

        expect(data.event_time).toBe("2026-06-18T00:00:00Z");
        expect(data.ingestion_time).toBe("2026-06-19T09:00:00Z");
        expect(data.last_accessed).toBe("2026-06-19T10:00:00Z");
        expect(data.access_count).toBe(7);
        expect(data.importance).toBe(0.82);
        expect(data.valid_to).toBeNull();
        expect(data.supersedes).toEqual(["mem-old"]);
    });

    it("should successfully recover from dirty yaml formats (Indentation Error Recovery)", () => {
        const doc = `---\ntitle: Broken Yaml\ntags: \n- invalid\n  - missing-colon\n- recovery-tag\n---\nBody text.`;
        const { data } = indexer.parseFrontmatter(doc);

        // Safe recovery should match successfully parsed list lines
        expect(data.tags).toContain("recovery-tag");
        expect(data.title).toBe("Broken Yaml");
    });

    it("should correctly compile O(1) tag indices when files are indexed", () => {
        const doc1 = `---\ntags: [agent, planning]\n---`;
        const doc2 = `---\ntags: [agent, coding]\n---`;

        indexer.indexFile("doc1.md", doc1);
        indexer.indexFile("doc2.md", doc2);

        const agentFiles = indexer.getFilesWithTag("agent");
        const codingFiles = indexer.getFilesWithTag("coding");

        expect(agentFiles.has("doc1.md")).toBe(true);
        expect(agentFiles.has("doc2.md")).toBe(true);
        expect(codingFiles.has("doc2.md")).toBe(true);
        expect(codingFiles.has("doc1.md")).toBe(false);
    });

    it("should perform fast tag intersection and union queries", () => {
        indexer.indexFile("doc1.md", "---\ntags: [agent, planning, local]\n---");
        indexer.indexFile("doc2.md", "---\ntags: [agent, coding, local]\n---");
        indexer.indexFile("doc3.md", "---\ntags: [agent, planning, remote]\n---");

        const allTags = indexer.getFilesWithAllTags(["agent", "planning"]);
        const anyTags = indexer.getFilesWithAnyTags(["coding", "remote"]);

        expect(allTags).toEqual(new Set(["doc1.md", "doc3.md"]));
        expect(anyTags).toEqual(new Set(["doc2.md", "doc3.md"]));
    });

    it("should atomically clean up old tag indexes when a file index is refreshed", () => {
        indexer.indexFile("doc1.md", "---\ntags: [agent, active]\n---");
        expect(indexer.getFilesWithTag("active").has("doc1.md")).toBe(true);

        // Update file to exclude 'active'
        indexer.indexFile("doc1.md", "---\ntags: [agent, archived]\n---");
        expect(indexer.getFilesWithTag("active").has("doc1.md")).toBe(false);
        expect(indexer.getFilesWithTag("archived").has("doc1.md")).toBe(true);
    });
});
