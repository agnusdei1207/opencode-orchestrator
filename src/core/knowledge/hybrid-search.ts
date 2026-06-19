/**
 * HybridSearch - Combines lexical (BM25-inspired), tag, and graph search
 * with Reciprocal Rank Fusion to surface the most relevant notes.
 */

import type { TagIndexer } from "./tag-indexer.js";
import type { FrontmatterData } from "./tag-indexer.js";
import type { GraphParser } from "./graph-parser.js";
import { type EngineWeights, NEUTRAL_WEIGHTS } from "./retrieval-weights.js";

/** Unified search result with provenance tracking. */
export interface SearchResult {
    noteName: string;
    score: number;
    matchType: "lexical" | "tag" | "graph";
}

/** RRF smoothing constant — standard value from the original RRF paper. */
const RRF_K = 60;
/** Default cap on returned results to bound output size. */
const DEFAULT_MAX_RESULTS = 20;
/** BM25 saturation parameter — controls term-frequency dampening. */
const BM25_K1 = 1.2;
/** BM25 length-normalization weight. */
const BM25_B = 0.75;
/** Graph traversal reaches 2-hop neighbors for contextual relevance. */
const GRAPH_HOP_DEPTH = 2;
const EXPIRED_MEMORY_MULTIPLIER = 0.35;
const MIN_MEMORY_STRENGTH = 0.05;

const KIND_DECAY: Record<string, number> = {
    sop: 0.006,
    workflow: 0.01,
    fact: 0.018,
    preference: 0.02,
    gotcha: 0.03,
    episode: 0.07,
};

export class HybridSearch {
    private readonly tagIndexer: TagIndexer;
    private readonly graphParser: GraphParser;
    /** Stores indexed note content keyed by note name. */
    private contentMap: Map<string, string> = new Map();
    /** Stores optional memory metadata keyed by note name for decay-aware ranking. */
    private metadataMap: Map<string, FrontmatterData> = new Map();

    constructor(tagIndexer: TagIndexer, graphParser: GraphParser) {
        this.tagIndexer = tagIndexer;
        this.graphParser = graphParser;
    }

    /**
     * Register note content for lexical search.
     * Must be called after TagIndexer.indexFile / GraphParser.indexFile.
     */
    public indexContent(noteName: string, content: string, metadata?: FrontmatterData): void {
        this.contentMap.set(noteName, content.toLowerCase());
        if (metadata) {
            this.metadataMap.set(noteName, metadata);
        } else {
            this.metadataMap.delete(noteName);
        }
    }

    /**
     * Fuse lexical, tag, and graph rankings via RRF to produce a single list.
     */
    public search(query: string, maxResults?: number, weights?: EngineWeights): SearchResult[] {
        const limit = maxResults ?? DEFAULT_MAX_RESULTS;
        const terms = this.tokenize(query);
        if (terms.length === 0) return [];

        const lexicalRanked = this.lexicalSearch(terms);
        const tagRanked = this.tagSearch(terms);
        const graphRanked = this.graphSearch(terms);

        return this.fuseResults(lexicalRanked, tagRanked, graphRanked, limit, weights ?? NEUTRAL_WEIGHTS);
    }

    /**
     * BM25-inspired term-frequency scoring across all indexed documents.
     * Approximates IDF via corpus size and document frequency.
     */
    private lexicalSearch(terms: string[]): string[] {
        const scores = new Map<string, number>();
        const corpusSize = this.contentMap.size;
        if (corpusSize === 0) return [];

        const avgLen = this.computeAverageLength();

        for (const term of terms) {
            const df = this.documentFrequency(term);
            const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5) + 1);

            for (const [name, content] of this.contentMap) {
                const tf = this.countOccurrences(content, term);
                if (tf === 0) continue;
                const docLen = content.length;
                const tfNorm = (tf * (BM25_K1 + 1)) /
                    (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgLen)));
                const prev = scores.get(name) ?? 0;
                scores.set(name, prev + idf * tfNorm);
            }
        }

        return this.sortByScore(scores);
    }

    /**
     * Match query terms against the tag index to find tagged notes.
     */
    private tagSearch(terms: string[]): string[] {
        const scores = new Map<string, number>();
        for (const term of terms) {
            const files = this.tagIndexer.getFilesWithTag(term);
            for (const file of files) {
                const noteName = this.graphParser.getNoteName(file);
                const prev = scores.get(noteName) ?? 0;
                scores.set(noteName, prev + 1);
            }
        }
        return this.sortByScore(scores);
    }

    /**
     * 2-hop graph traversal from tag-matched seed notes to discover related notes.
     */
    private graphSearch(terms: string[]): string[] {
        const seeds = new Set<string>(this.tagSearch(terms));
        const visited = new Set<string>();
        const scores = new Map<string, number>();

        for (const seed of seeds) {
            this.traverseGraph(seed, GRAPH_HOP_DEPTH, visited, scores);
        }
        return this.sortByScore(scores);
    }

    /**
     * Depth-limited BFS from a seed note, scoring neighbors by proximity.
     */
    private traverseGraph(
        note: string,
        depth: number,
        visited: Set<string>,
        scores: Map<string, number>,
    ): void {
        if (depth <= 0 || visited.has(note)) return;
        visited.add(note);

        const neighbors = [
            ...this.graphParser.getForwardLinks(note),
            ...this.graphParser.getBacklinks(note),
        ];

        for (const neighbor of neighbors) {
            const prev = scores.get(neighbor) ?? 0;
            scores.set(neighbor, prev + depth);
            this.traverseGraph(neighbor, depth - 1, visited, scores);
        }
    }

    /**
     * Reciprocal Rank Fusion: combine three ranked lists into a single ranking.
     * Formula: score(d) = Σ 1/(k + rank_i) for each list where d appears.
     */
    private fuseResults(
        lexical: string[],
        tags: string[],
        graph: string[],
        limit: number,
        weights: EngineWeights,
    ): SearchResult[] {
        const fused = new Map<string, { score: number; matchType: SearchResult["matchType"] }>();

        this.addRrfScores(fused, lexical, "lexical", weights.lexical);
        this.addRrfScores(fused, tags, "tag", weights.tag);
        this.addRrfScores(fused, graph, "graph", weights.graph);

        return Array.from(fused.entries())
            .map(([noteName, { score, matchType }]) => ({
                noteName,
                score: score * memoryStrength(this.metadataMap.get(noteName)),
                matchType,
            }))
            .filter(result => result.score > 0 && isPromptSafeMemory(this.metadataMap.get(result.noteName)))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Accumulate RRF scores from a single ranked list into the fused map.
     * The matchType is set to the source with the highest individual contribution.
     */
    private addRrfScores(
        fused: Map<string, { score: number; matchType: SearchResult["matchType"] }>,
        ranked: string[],
        matchType: SearchResult["matchType"],
        weight: number = 1,
    ): void {
        for (let i = 0; i < ranked.length; i++) {
            const rrfScore = weight * (1 / (RRF_K + i + 1));
            const existing = fused.get(ranked[i]);
            if (existing) {
                existing.score += rrfScore;
                if (rrfScore > 1 / (RRF_K + 1)) {
                    existing.matchType = matchType;
                }
            } else {
                fused.set(ranked[i], { score: rrfScore, matchType });
            }
        }
    }

    /** Split query into lowercase tokens for matching. */
    private tokenize(query: string): string[] {
        return query.toLowerCase().split(/\s+/).filter(Boolean);
    }

    /** Count non-overlapping occurrences of a term in text. */
    private countOccurrences(text: string, term: string): number {
        let count = 0;
        let pos = 0;
        while ((pos = text.indexOf(term, pos)) !== -1) {
            count++;
            pos += term.length;
        }
        return count;
    }

    /** Average document length across the corpus (character-based). */
    private computeAverageLength(): number {
        let total = 0;
        for (const content of this.contentMap.values()) {
            total += content.length;
        }
        return total / Math.max(this.contentMap.size, 1);
    }

    /** Number of documents containing the given term. */
    private documentFrequency(term: string): number {
        let count = 0;
        for (const content of this.contentMap.values()) {
            if (content.includes(term)) count++;
        }
        return count;
    }

    /** Sort entries by descending score and return the keys in order. */
    private sortByScore(scores: Map<string, number>): string[] {
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);
    }
}

function memoryStrength(metadata: FrontmatterData | undefined, now = Date.now()): number {
    if (!metadata || metadata.keep) return 1;
    if (metadata.memory_layer === "archive") return 0;

    const hasMemoryMetadata = [
        metadata.event_time,
        metadata.ingestion_time,
        metadata.last_accessed,
        metadata.valid_to,
        metadata.decay_lambda,
        metadata.access_count,
        metadata.access_ema,
        metadata.importance,
        metadata.confidence,
        metadata.memory_kind,
    ].some(value => value !== undefined && value !== null);
    if (!hasMemoryMetadata) return 1;

    const lastSeen = timestampMillis(metadata.last_accessed ?? metadata.ingestion_time) ?? now;
    const ageDays = Math.max(0, (now - lastSeen) / 86_400_000);
    const lambda = numberOr(metadata.decay_lambda, KIND_DECAY[metadata.memory_kind ?? "fact"] ?? 0.03);
    const access = numberOr(metadata.access_ema, numberOr(metadata.access_count, 0));
    const quality = Math.max(0.1, numberOr(metadata.importance, 1) * numberOr(metadata.confidence, 1));
    const reinforcement = 1 + Math.log1p(access) / 4;
    const expiry = isExpired(metadata.valid_to, now) ? EXPIRED_MEMORY_MULTIPLIER : 1;

    return clamp(quality * reinforcement * Math.exp(-lambda * ageDays) * expiry, MIN_MEMORY_STRENGTH, 1);
}

function isPromptSafeMemory(metadata: FrontmatterData | undefined): boolean {
    if (!metadata) return true;
    return metadata.privacy_class !== "sensitive" && metadata.memory_layer !== "malicious";
}

function numberOr(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function timestampMillis(value: unknown): number | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function isExpired(validTo: unknown, now: number): boolean {
    const expiresAt = timestampMillis(validTo);
    return expiresAt !== null && expiresAt < now;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
