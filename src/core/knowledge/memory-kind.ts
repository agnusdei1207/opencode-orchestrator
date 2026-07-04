import type { FrontmatterData } from "./tag-indexer.js";

export type CognitiveMemoryKind = "episodic" | "semantic" | "procedural";

export const DEFAULT_MEMORY_DECAY_LAMBDA = 0.03;

/** Per-kind exponential decay rate (lambda, per day). */
export const KIND_DECAY: Record<string, number> = {
    procedural: 0.006,
    semantic: 0.018,
    episodic: 0.07,
    sop: 0.006,
    workflow: 0.01,
    fact: 0.018,
    preference: 0.02,
    gotcha: 0.03,
    episode: 0.07,
};

export type MemoryKindWeights = Partial<Record<CognitiveMemoryKind, number>>;

export function normalizeMemoryKind(value: unknown): CognitiveMemoryKind | null {
    if (value === "episodic" || value === "episode") return "episodic";
    if (value === "semantic" || value === "fact" || value === "preference" || value === "gotcha") {
        return "semantic";
    }
    if (value === "procedural" || value === "workflow" || value === "sop") return "procedural";
    return null;
}

export function decayLambdaForMetadata(metadata: FrontmatterData | undefined): number {
    if (!metadata) return DEFAULT_MEMORY_DECAY_LAMBDA;
    const explicit = metadata.decay_lambda;
    if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
    return KIND_DECAY[metadata.memory_kind ?? "fact"] ?? DEFAULT_MEMORY_DECAY_LAMBDA;
}

export function memoryKindWeight(
    metadata: FrontmatterData | undefined,
    weights: MemoryKindWeights | undefined,
): number {
    const kind = normalizeMemoryKind(metadata?.memory_kind);
    if (!kind) return 1;
    const weight = weights?.[kind];
    return typeof weight === "number" && Number.isFinite(weight) ? weight : 1;
}
