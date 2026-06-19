import type { SearchResult } from "./hybrid-search.js";

export type MemoryEvalCategory =
    | "static_state"
    | "dynamic_state"
    | "workflow"
    | "gotcha"
    | "premise_awareness";

export interface MemoryEvalCase {
    id: string;
    category: MemoryEvalCategory;
    query: string;
    expectedNote: string;
}

export interface MemoryEvalCategoryResult {
    category: MemoryEvalCategory;
    total: number;
    hits: number;
    mrrAt10: number;
}

export interface MemoryEvalResult {
    total: number;
    hits: number;
    accuracy: number;
    mrrAt10: number;
    categories: MemoryEvalCategoryResult[];
}

export function evaluateMemoryRetrieval(
    cases: MemoryEvalCase[],
    search: (query: string, limit: number) => SearchResult[],
): MemoryEvalResult {
    const categoryStats = new Map<MemoryEvalCategory, { total: number; hits: number; reciprocal: number }>();
    let hits = 0;
    let reciprocal = 0;

    for (const testCase of cases) {
        const results = search(testCase.query, 10);
        const rank = results.findIndex(result => result.noteName === testCase.expectedNote);
        const hit = rank >= 0;
        const rr = hit ? 1 / (rank + 1) : 0;
        if (hit) hits += 1;
        reciprocal += rr;

        const stats = categoryStats.get(testCase.category) ?? { total: 0, hits: 0, reciprocal: 0 };
        stats.total += 1;
        stats.hits += hit ? 1 : 0;
        stats.reciprocal += rr;
        categoryStats.set(testCase.category, stats);
    }

    const total = cases.length;
    return {
        total,
        hits,
        accuracy: total === 0 ? 0 : hits / total,
        mrrAt10: total === 0 ? 0 : reciprocal / total,
        categories: Array.from(categoryStats.entries())
            .map(([category, stats]) => ({
                category,
                total: stats.total,
                hits: stats.hits,
                mrrAt10: stats.total === 0 ? 0 : stats.reciprocal / stats.total,
            }))
            .sort((a, b) => a.category.localeCompare(b.category)),
    };
}
