/**
 * memory-scoring.ts — Single source of truth for the local Ebbinghaus memory
 * scoring math.
 *
 * Both the retrieval ranker (`hybrid-search.ts`) and the lifecycle/maintenance
 * engine (`memory-lifecycle.ts`) import the canonical decay model from here.
 * Do NOT re-derive these constants or the `memoryStrength()` formula elsewhere.
 *
 * Shipped behavior (must stay stable):
 *  - strength is clamped to [0.05, 1.0]
 *  - quality = max(0.1, importance(=1) * confidence(=1))
 *  - keep === true            => 1.0
 *  - memory_layer "archive"   => 0
 *  - expired valid_to         => × 0.35
 *  - lastSeen = last_accessed ?? ingestion_time ?? now
 *  - reinforcement = 1 + log1p(access) / 4
 *  - access = access_ema ?? access_count ?? 0
 */

import type { FrontmatterData } from "./tag-indexer.js";
import { decayLambdaForMetadata } from "./memory-kind.js";

export type MemoryLayer = "hot" | "warm" | "cold" | "archive";

/** Minimum non-zero strength floor applied by the clamp. */
export const MIN_MEMORY_STRENGTH = 0.05;
/** Multiplier applied when a record's `valid_to` is in the past. */
export const EXPIRED_MEMORY_MULTIPLIER = 0.35;

export { KIND_DECAY } from "./memory-kind.js";

/** Strength → memory layer thresholds, evaluated in order. */
export const LAYER_THRESHOLDS: Array<[MemoryLayer, number]> = [
    ["hot", 0.75],
    ["warm", 0.35],
    ["cold", 0.08],
    ["archive", 0],
];

/**
 * True when the record carries any memory/bi-temporal metadata and should
 * therefore participate in decay-aware scoring.
 */
export function hasMemoryMetadata(metadata: FrontmatterData | undefined): boolean {
    if (!metadata) return false;
    return [
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
        metadata.memory_layer,
        metadata.valid_from,
        metadata.supersedes,
    ].some(value => value !== undefined && value !== null);
}

/**
 * Canonical Ebbinghaus-style memory strength in [0.05, 1.0].
 * Records without memory metadata (and `keep` records) score 1.0 so plain
 * docs rank unchanged; archived records score 0.
 */
export function memoryStrength(metadata: FrontmatterData | undefined, now = Date.now()): number {
    if (!metadata || metadata.keep === true) return 1;
    if (metadata.memory_layer === "archive") return 0;
    if (!hasMemoryMetadata(metadata)) return 1;

    const lastSeen = timestampMillis(metadata.last_accessed ?? metadata.ingestion_time) ?? now;
    const ageDays = Math.max(0, (now - lastSeen) / 86_400_000);
    const lambda = decayLambdaForMetadata(metadata);
    const access = numberOr(metadata.access_ema, numberOr(metadata.access_count, 0));
    const quality = Math.max(0.1, numberOr(metadata.importance, 1) * numberOr(metadata.confidence, 1));
    const reinforcement = 1 + Math.log1p(access) / 4;
    const expiry = isExpired(metadata.valid_to, now) ? EXPIRED_MEMORY_MULTIPLIER : 1;

    return clamp(quality * reinforcement * Math.exp(-lambda * ageDays) * expiry, MIN_MEMORY_STRENGTH, 1);
}

/**
 * Excludes records that must never be injected into a prompt: sensitive
 * privacy class, malicious layer, or tombstoned.
 */
export function isPromptSafeMemory(metadata: FrontmatterData | undefined): boolean {
    if (!metadata) return true;
    return metadata.privacy_class !== "sensitive"
        && metadata.memory_layer !== "malicious"
        && metadata.tombstone !== true;
}

/** Map a strength value to its memory layer using LAYER_THRESHOLDS. */
export function layerForStrength(strength: number): MemoryLayer {
    for (const [layer, threshold] of LAYER_THRESHOLDS) {
        if (strength >= threshold) return layer;
    }
    return "archive";
}

export function isExpired(validTo: unknown, now: number): boolean {
    const expiresAt = timestampMillis(validTo);
    return expiresAt !== null && expiresAt < now;
}

export function numberOr(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function timestampMillis(value: unknown): number | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
