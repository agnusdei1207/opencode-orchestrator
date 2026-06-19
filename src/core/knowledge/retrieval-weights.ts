/**
 * Role-aware retrieval weights and memory horizons.
 *
 * Builder learning (adoption assessment 2026-06-19, item E):
 * - Context horizons classify a memory by how long it stays relevant
 *   (`builder` MEMORY-SYSTEM deep dive: strategic / execution / closure).
 * - The contextual reranker biases retrieval engines differently per role
 *   (`unified_retrieval.rs`): planners favor structure, workers favor exact
 *   lexical hits, reviewers favor breadth.
 *
 * Defaults are neutral (all weights = 1), so omitting a role leaves retrieval
 * behavior unchanged.
 */

/** Relative multipliers applied to each hybrid-search engine's RRF contribution. */
export interface EngineWeights {
    lexical: number;
    tag: number;
    graph: number;
}

export const NEUTRAL_WEIGHTS: EngineWeights = { lexical: 1, tag: 1, graph: 1 };

/**
 * Per-role engine bias. Roles are matched case-insensitively; unknown roles
 * fall back to neutral weights.
 */
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    // Planner reasons about dependencies/architecture -> favor structure.
    planner: { lexical: 0.8, tag: 1.1, graph: 1.3 },
    // Worker implements concrete changes -> favor exact lexical hits.
    worker: { lexical: 1.3, tag: 1.0, graph: 0.7 },
    // Reviewer needs breadth of evidence -> favor tag/topic coverage.
    reviewer: { lexical: 1.0, tag: 1.2, graph: 1.0 },
    // Commander coordinates -> neutral.
    commander: { lexical: 1, tag: 1, graph: 1 },
};

export function weightsForRole(role?: string | null): EngineWeights {
    if (!role) return NEUTRAL_WEIGHTS;
    return ROLE_WEIGHTS[role.toLowerCase()] ?? NEUTRAL_WEIGHTS;
}

/** Memory relevance horizon, derived from the memory level. */
export type MemoryHorizon = "strategic" | "execution" | "closure";

export function horizonForLevel(level: string): MemoryHorizon {
    switch (level) {
        case "system":
        case "project":
            return "strategic";
        case "task":
            return "closure";
        case "mission":
        default:
            return "execution";
    }
}
