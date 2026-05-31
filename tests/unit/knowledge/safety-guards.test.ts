import { describe, it, expect, beforeEach } from "vitest";
import { SafetyGuards } from "../../../src/core/knowledge/safety-guards";
import { GraphParser } from "../../../src/core/knowledge/graph-parser";

describe("SafetyGuards - Graph Integrity & Concurrency Primitives", () => {
    let parser: GraphParser;

    beforeEach(() => {
        parser = new GraphParser();
    });

    it("should detect a direct circular link (A -> B -> A)", () => {
        parser.indexFile("docs/A.md", "Link to [[B]]");
        parser.indexFile("docs/B.md", "Link back to [[A]]");

        expect(SafetyGuards.checkCircularLinks(parser, "A")).toBe(true);
    });

    it("should detect a 3-hop circular link (A -> B -> C -> A) with sufficient depth", () => {
        parser.indexFile("docs/A.md", "Link to [[B]]");
        parser.indexFile("docs/B.md", "Link to [[C]]");
        parser.indexFile("docs/C.md", "Link back to [[A]]");

        // A→B→C→A requires 3 hops of DFS depth to detect
        expect(SafetyGuards.checkCircularLinks(parser, "A", 3)).toBe(true);
        // Default maxDepth=2 cannot reach C's neighbors, so no detection
        expect(SafetyGuards.checkCircularLinks(parser, "A", 2)).toBe(false);
    });

    it("should return false when no circular link exists", () => {
        parser.indexFile("docs/A.md", "Link to [[B]]");
        parser.indexFile("docs/B.md", "Link to [[C]]");
        parser.indexFile("docs/C.md", "Leaf note with no links back.");

        expect(SafetyGuards.checkCircularLinks(parser, "A")).toBe(false);
    });

    it("should respect custom maxDepth for cycle detection", () => {
        // Chain: A -> B -> C -> D -> A (3-hop cycle)
        parser.indexFile("docs/A.md", "[[B]]");
        parser.indexFile("docs/B.md", "[[C]]");
        parser.indexFile("docs/C.md", "[[D]]");
        parser.indexFile("docs/D.md", "[[A]]");

        // At depth 2, cannot reach back to A (would need depth 3)
        expect(SafetyGuards.checkCircularLinks(parser, "A", 2)).toBe(false);
        // At depth 3, it should detect the cycle
        // A's neighbors: B. B's neighbors: C. C's neighbors: D. D's neighbors: A.
        expect(SafetyGuards.checkCircularLinks(parser, "A", 4)).toBe(true);
    });

    it("should correctly identify pinned metadata via keep: true", () => {
        expect(SafetyGuards.isPinned({ keep: true })).toBe(true);
        expect(SafetyGuards.isPinned({ keep: false })).toBe(false);
        expect(SafetyGuards.isPinned({})).toBe(false);
        expect(SafetyGuards.isPinned({ tags: ["important"] })).toBe(false);
    });

    it("should create a WriteQueue that serializes concurrent writes in FIFO order", async () => {
        const queue = SafetyGuards.createWriteQueue();
        const order: number[] = [];

        await queue.enqueue(async () => {
            order.push(1);
        });

        await queue.enqueue(async () => {
            order.push(2);
        });

        await queue.enqueue(async () => {
            order.push(3);
        });

        await queue.drain();
        expect(order).toEqual([1, 2, 3]);
    });

    it("should allow drain to complete even if a queued write throws", async () => {
        const queue = SafetyGuards.createWriteQueue();
        const completed: string[] = [];

        await queue.enqueue(async () => {
            completed.push("first");
        });

        // This should throw but not break the chain
        try {
            await queue.enqueue(async () => {
                throw new Error("write failure");
            });
        } catch {
            // Expected
        }

        await queue.enqueue(async () => {
            completed.push("third");
        });

        await queue.drain();
        expect(completed).toContain("first");
        expect(completed).toContain("third");
    });

    it("should handle self-referencing notes in circular detection", () => {
        parser.indexFile("docs/Self.md", "Links to [[Self]]");

        expect(SafetyGuards.checkCircularLinks(parser, "Self")).toBe(true);
    });
});
