import { describe, it, expect, beforeEach } from "vitest";
import { HybridSearch } from "../../../src/core/knowledge/hybrid-search";
import { TagIndexer } from "../../../src/core/knowledge/tag-indexer";
import { GraphParser } from "../../../src/core/knowledge/graph-parser";

describe("HybridSearch - BM25 + Tag + Graph Fusion RAG", () => {
    let indexer: TagIndexer;
    let parser: GraphParser;
    let search: HybridSearch;

    beforeEach(() => {
        indexer = new TagIndexer();
        parser = new GraphParser();
        search = new HybridSearch(indexer, parser);
    });

    it("should return empty results for an empty query", () => {
        const results = search.search("");
        expect(results).toEqual([]);
    });

    it("should return empty results when no content is indexed", () => {
        const results = search.search("agent");
        expect(results).toEqual([]);
    });

    it("should find notes via lexical BM25 term-frequency matching", () => {
        const content = "The agent orchestrates planning and agent tasks for the agent framework.";
        search.indexContent("agent-guide", content);

        const results = search.search("agent");
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].noteName).toBe("agent-guide");
    });

    it("should find notes via tag matching against the tag index", () => {
        const doc = `---\ntags: [planning, agent]\n---\nSome body text.`;
        indexer.indexFile("docs/planning.md", doc);
        parser.indexFile("docs/planning.md", doc);
        search.indexContent("planning", doc);

        const results = search.search("agent");
        expect(results.length).toBeGreaterThan(0);

        const names = results.map(r => r.noteName);
        expect(names).toContain("planning");
    });

    it("should discover related notes via 2-hop graph traversal", () => {
        // Build a graph: MOC -> NoteA -> NoteB
        const moc = `---\ntags: [moc]\n---\n[[NoteA]]`;
        const noteA = `---\ntags: [moc]\n---\n[[NoteB]]`;
        const noteB = `---\ntags: [detail]\n---\nSome deep content.`;

        indexer.indexFile("docs/MOC.md", moc);
        indexer.indexFile("docs/NoteA.md", noteA);
        indexer.indexFile("docs/NoteB.md", noteB);

        parser.indexFile("docs/MOC.md", moc);
        parser.indexFile("docs/NoteA.md", noteA);
        parser.indexFile("docs/NoteB.md", noteB);

        search.indexContent("MOC", moc);
        search.indexContent("NoteA", noteA);
        search.indexContent("NoteB", noteB);

        // Searching for "moc" should find MOC and NoteA (tagged),
        // and NoteB should appear via graph traversal
        const results = search.search("moc");
        const names = results.map(r => r.noteName);
        expect(names).toContain("NoteB");
    });

    it("should respect maxResults limit", () => {
        for (let i = 0; i < 10; i++) {
            search.indexContent(`note-${i}`, `agent content for note ${i}`);
        }

        const results = search.search("agent", 3);
        expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should rank notes with multiple signal matches higher via RRF", () => {
        // Note with both lexical and tag match should rank higher
        const taggedDoc = `---\ntags: [typescript]\n---\nTypeScript is a typed superset of JavaScript.`;
        const plainDoc = `TypeScript basics and fundamentals of coding.`;

        indexer.indexFile("docs/ts-guide.md", taggedDoc);
        parser.indexFile("docs/ts-guide.md", taggedDoc);
        search.indexContent("ts-guide", taggedDoc);
        search.indexContent("plain-doc", plainDoc);

        const results = search.search("typescript");
        expect(results.length).toBeGreaterThanOrEqual(1);

        // The tagged doc should generally rank at or above the plain doc
        const taggedIdx = results.findIndex(r => r.noteName === "ts-guide");
        const plainIdx = results.findIndex(r => r.noteName === "plain-doc");
        if (taggedIdx !== -1 && plainIdx !== -1) {
            expect(taggedIdx).toBeLessThanOrEqual(plainIdx);
        }
    });

    it("should demote explicitly expired bi-temporal memory without affecting neutral notes", () => {
        const freshDoc = "Kerberoasting defense uses SPN monitoring and rotation.";
        const expiredDoc = "Kerberoasting defense uses SPN monitoring and rotation.";

        search.indexContent("expired-memory", expiredDoc, {
            event_time: "2024-03-15T00:00:00Z",
            ingestion_time: "2024-03-20T00:00:00Z",
            valid_to: "2024-04-01T00:00:00Z",
            decay_lambda: 0.2,
            memory_kind: "episode",
        });
        search.indexContent("fresh-memory", freshDoc, {
            event_time: "2026-06-18T00:00:00Z",
            ingestion_time: "2026-06-19T00:00:00Z",
            decay_lambda: 0.006,
            memory_kind: "sop",
            access_count: 5,
        });
        search.indexContent("neutral-note", freshDoc);

        const results = search.search("Kerberoasting SPN monitoring", 3);

        expect(results[0].noteName).toBe("fresh-memory");
        expect(results.findIndex(result => result.noteName === "expired-memory"))
            .toBeGreaterThan(results.findIndex(result => result.noteName === "neutral-note"));
    });
});
