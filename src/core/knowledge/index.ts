/**
 * Knowledge Module - Barrel Export
 *
 * Re-exports all knowledge graph modules (Phase 1-7)
 * for clean module boundary access from the rest of the framework.
 */

export { TagIndexer } from "./tag-indexer.js";
export type { FrontmatterData } from "./tag-indexer.js";
export { GraphParser } from "./graph-parser.js";
export { HybridSearch } from "./hybrid-search.js";
export type { SearchResult } from "./hybrid-search.js";
export { Scratchpad } from "./scratchpad.js";
export { SafetyGuards } from "./safety-guards.js";
export type { WriteQueue } from "./safety-guards.js";
export { MemoryConsolidation } from "./memory-consolidation.js";
