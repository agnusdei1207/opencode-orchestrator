import { describe, expect, it } from "vitest";
import { evaluateMemoryRetrieval, type MemoryEvalCase } from "../../../src/core/knowledge/memory-evaluation.js";
import { GraphParser } from "../../../src/core/knowledge/graph-parser.js";
import { HybridSearch } from "../../../src/core/knowledge/hybrid-search.js";
import { TagIndexer } from "../../../src/core/knowledge/tag-indexer.js";

describe("memory evaluation harness", () => {
    it("scores LongMemEval-style local memory categories with MRR@10", () => {
        const indexer = new TagIndexer();
        const graph = new GraphParser();
        const search = new HybridSearch(indexer, graph);

        const notes = [
            ["static-state", "The lab subnet gateway is 10.10.14.1.", "static_state"],
            ["dynamic-state", "The latest patch changed CVE-2024-1234 priority to low.", "dynamic_state"],
            ["workflow", "Kerberoasting workflow starts with SPN enumeration before ticket requests.", "workflow"],
            ["gotcha", "Gotcha: mini PC Docker logs rotate every two hours during simulation.", "gotcha"],
            ["premise-awareness", "Premise: production redeploy requires green focused tests first.", "premise_awareness"],
        ] as const;

        for (const [name, body, kind] of notes) {
            search.indexContent(name, body, {
                event_time: "2026-06-19T00:00:00Z",
                ingestion_time: "2026-06-19T01:00:00Z",
                last_accessed: "2026-06-19T01:00:00Z",
                access_count: 2,
                memory_kind: kind,
                memory_layer: "warm",
            });
        }

        const cases: MemoryEvalCase[] = [
            { id: "static", category: "static_state", query: "lab subnet gateway", expectedNote: "static-state" },
            { id: "dynamic", category: "dynamic_state", query: "CVE-2024-1234 latest patch priority", expectedNote: "dynamic-state" },
            { id: "workflow", category: "workflow", query: "Kerberoasting SPN enumeration workflow", expectedNote: "workflow" },
            { id: "gotcha", category: "gotcha", query: "mini PC docker logs rotate simulation", expectedNote: "gotcha" },
            { id: "premise", category: "premise_awareness", query: "production redeploy requires green tests", expectedNote: "premise-awareness" },
        ];

        const result = evaluateMemoryRetrieval(cases, (query, limit) => search.search(query, limit));

        expect(result.total).toBe(5);
        expect(result.accuracy).toBe(1);
        expect(result.mrrAt10).toBe(1);
        expect(result.categories.every(category => category.hits === category.total)).toBe(true);
    });
});
